"""Staff sign-in for the dashboard.

Sign-in, refresh and sign-out only answer the website's own server. Everyone
else gets a 404, so passwords can't be guessed against the API directly.
"""
from axes.handlers.proxy import AxesProxyHandler
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth.signals import user_logged_in, user_login_failed
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from rest_framework import permissions, serializers
from rest_framework.exceptions import APIException, NotFound, Throttled
from rest_framework.response import Response
from rest_framework.throttling import SimpleRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.serializers import TokenObtainSerializer
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenBlacklistView, TokenObtainPairView, TokenRefreshView

from church_erp.api.throttling import ClientAddressMixin
from church_erp.core.client_address import has_internal_secret

from . import two_factor
from .models import User
from church_erp.workspace.scopes import is_member


class FromWebsiteServer(permissions.BasePermission):
    def has_permission(self, request, view):
        if not has_internal_secret(request):
            raise NotFound()
        return True


class IsStaff(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.is_staff)


class LoginThrottle(ClientAddressMixin, SimpleRateThrottle):
    scope = "login"

    def get_cache_key(self, request, view):
        return self.cache_format % {"scope": self.scope, "ident": self.get_ident(request)}


def signed_in_response(request, user):
    # Tokens don't go through Django's login(), so report it here. This clears
    # earlier failed attempts and records the login.
    user_logged_in.send(sender=type(user), request=request._request, user=user)
    refresh = RefreshToken.for_user(user)
    return Response({"access": str(refresh.access_token), "refresh": str(refresh)})


class CredentialsSerializer(TokenObtainSerializer):
    """Checks the password only; the view decides what comes next."""
    token_class = RefreshToken


class LoginView(TokenObtainPairView):
    permission_classes = [FromWebsiteServer]
    throttle_classes = [LoginThrottle]
    serializer_class = CredentialsSerializer

    def get_serializer_context(self):
        # django-axes marks a lockout on Django's own request, for its middleware to answer.
        return {**super().get_serializer_context(), "request": self.request._request}

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        try:
            serializer.is_valid(raise_exception=True)
        except TokenError as exc:
            raise InvalidToken(exc.args[0])
        user = serializer.user
        if two_factor.has_two_factor(user):
            return Response({"two_factor_required": True, "challenge": two_factor.make_challenge(user)})
        return signed_in_response(request, user)


class SecondStepRefused(APIException):
    status_code = 401


class LoginVerifyView(APIView):
    """The second step: a code from the authenticator app, or a recovery code."""
    authentication_classes = []
    permission_classes = [FromWebsiteServer]
    throttle_classes = [LoginThrottle]

    def post(self, request):
        user = two_factor.read_challenge(request.data.get("challenge", ""))
        if user is None:
            raise SecondStepRefused("Please sign in again.", code="challenge_invalid")
        credentials = {"username": user.get_username()}
        if not AxesProxyHandler.is_allowed(request._request, credentials):
            raise Throttled(detail="Too many attempts.")
        if not two_factor.verify_code(user, request.data.get("code", "")):
            # Counts towards the same lockout as a wrong password.
            user_login_failed.send(sender=type(user), credentials=credentials, request=request._request)
            raise SecondStepRefused("That code isn't right.", code="code_invalid")
        return signed_in_response(request, user)


class RefreshView(TokenRefreshView):
    permission_classes = [FromWebsiteServer]

    def post(self, request, *args, **kwargs):
        try:
            return super().post(request, *args, **kwargs)
        except User.DoesNotExist:
            # The account was deleted after this session began.
            raise InvalidToken("Please sign in again.")


class LogoutView(TokenBlacklistView):
    permission_classes = [FromWebsiteServer]


class MeView(APIView):
    permission_classes = [IsStaff]

    def get(self, request):
        user = request.user
        branch = user.branch
        return Response({
            "username": user.username,
            "name": user.get_full_name() or user.username,
            "role": user.role,
            "role_label": "Superuser" if user.is_superuser else user.get_role_display(),
            "branch": {"slug": branch.slug, "name": branch.name} if branch else None,
            "is_superuser": user.is_superuser,
            "must_change_password": user.must_change_password,
            "two_factor_enabled": two_factor.has_two_factor(user),
            "must_set_up_two_factor": two_factor.must_set_up_two_factor(user),
            # Whether to offer the shared workspace (Task 8.1).
            "workspace_member": is_member(user),
        })


class PasswordChangeSerializer(serializers.Serializer):
    current_password = serializers.CharField(trim_whitespace=False)
    new_password = serializers.CharField(trim_whitespace=False)

    def validate_current_password(self, value):
        if not self.context["user"].check_password(value):
            raise serializers.ValidationError("That isn't your current password.")
        return value

    def validate_new_password(self, value):
        user = self.context["user"]
        if user.check_password(value):
            raise serializers.ValidationError("Choose a password different from your current one.")
        try:
            validate_password(value, user)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(list(exc.messages))
        return value


class PasswordChangeView(APIView):
    permission_classes = [IsStaff]

    def post(self, request):
        user = request.user
        serializer = PasswordChangeSerializer(data=request.data, context={"user": user})
        serializer.is_valid(raise_exception=True)
        with transaction.atomic():
            user.set_password(serializer.validated_data["new_password"])
            user.must_change_password = False
            user.save(update_fields=["password", "must_change_password"])
            # Sign out everywhere else. Access tokens end with the old password
            # (CHECK_REVOKE_TOKEN); refresh tokens need blacklisting.
            two_factor.end_sessions(user)
        refresh = RefreshToken.for_user(user)
        return Response({"access": str(refresh.access_token), "refresh": str(refresh)})


class TwoFactorAlreadyOn(APIException):
    status_code = 409
    default_detail = "Two-step login is already on."
    default_code = "two_factor_already_on"


class TwoFactorSetupView(APIView):
    permission_classes = [IsStaff]

    def get(self, request):
        if two_factor.has_two_factor(request.user):
            raise TwoFactorAlreadyOn()
        return Response(two_factor.setup_details(two_factor.pending_device(request.user)))


class TwoFactorConfirmView(APIView):
    permission_classes = [IsStaff]

    def post(self, request):
        user = request.user
        if two_factor.has_two_factor(user):
            raise TwoFactorAlreadyOn()
        device = two_factor.pending_device(user)
        code = "".join(str(request.data.get("code", "")).split())
        if not device.verify_token(code):
            raise serializers.ValidationError({"code": ["That code isn't right. Please try the newest one."]})
        codes = two_factor.confirm_device(user, device)
        refresh = RefreshToken.for_user(user)
        return Response({
            "access": str(refresh.access_token),
            "refresh": str(refresh),
            "recovery_codes": codes,
        })
