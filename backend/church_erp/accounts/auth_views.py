"""Staff sign-in for the dashboard.

Sign-in, refresh and sign-out only answer the website's own server. Everyone
else gets a 404, so passwords can't be guessed against the API directly.
"""
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth.signals import user_logged_in
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from rest_framework import permissions, serializers
from rest_framework.exceptions import NotFound
from rest_framework.response import Response
from rest_framework.throttling import SimpleRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenBlacklistView, TokenObtainPairView, TokenRefreshView

from church_erp.api.throttling import ClientAddressMixin
from church_erp.core.client_address import has_internal_secret


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


class LoginView(TokenObtainPairView):
    permission_classes = [FromWebsiteServer]
    throttle_classes = [LoginThrottle]

    def get_serializer_context(self):
        # django-axes marks a lockout on Django's own request, for its middleware to answer.
        return {**super().get_serializer_context(), "request": self.request._request}

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        try:
            serializer.is_valid(raise_exception=True)
        except TokenError as exc:
            raise InvalidToken(exc.args[0])
        # Tokens don't go through Django's login(), so report it here. This
        # clears earlier failed attempts and records the login.
        user_logged_in.send(sender=type(serializer.user), request=request._request, user=serializer.user)
        return Response(serializer.validated_data)


class RefreshView(TokenRefreshView):
    permission_classes = [FromWebsiteServer]


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
            for token in OutstandingToken.objects.filter(user=user):
                BlacklistedToken.objects.get_or_create(token=token)
        refresh = RefreshToken.for_user(user)
        return Response({"access": str(refresh.access_token), "refresh": str(refresh)})
