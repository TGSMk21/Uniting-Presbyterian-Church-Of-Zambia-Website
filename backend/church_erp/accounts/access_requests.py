"""Asking for access and approving it (AGENT_EXECUTION_PLAN.md, Task 7.2).

- POST /api/access-requests/: the website's server passes on a visitor's request.
  The answer is always the same, so it can't be used to learn who has an account.
- /api/staff-requests/: superusers review every request; a minister's account
  (a Branch Admin) reviews its own branch's requests from other staff (decision D2).
- Approving makes the account with no usable password and a single-use link to
  choose one, which is shown once to the approver (decision D3).
- /api/auth/password-link/check/ and .../use/: the website's server opens a link.
"""
import re

from django.contrib.auth.password_validation import validate_password
from django.contrib.auth.validators import UnicodeUsernameValidator
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.utils import timezone
from rest_framework import serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import APIException, NotFound, PermissionDenied
from rest_framework.response import Response
from rest_framework.throttling import SimpleRateThrottle
from rest_framework.views import APIView

from church_erp.api.throttling import ClientAddressMixin
from church_erp.core.changes import record
from church_erp.core.models import Branch, Minister

from .auth_views import FromWebsiteServer, IsStaff
from .models import AccessRequest, User
from .password_links import make_link, usable_link, use_link
from .staff_people import MANAGED_ROLES, is_branch_admin, link_minister

PHONE = re.compile(r"[0-9+()\- ]{6,20}")
NOTE_LENGTH = 1000
LINK_GONE = "This link has expired or has already been used. Please ask for a new one."


class AddressThrottle(ClientAddressMixin, SimpleRateThrottle):
    def get_cache_key(self, request, view):
        return self.cache_format % {"scope": self.scope, "ident": self.get_ident(request)}


class AskThrottle(AddressThrottle):
    scope = "access_request"


class LinkThrottle(AddressThrottle):
    scope = "password_link"


# --- Asking ---

class AskSerializer(serializers.Serializer):
    full_name = serializers.CharField(max_length=150)
    email = serializers.EmailField(max_length=254)
    phone = serializers.CharField(max_length=20)
    branch = serializers.SlugRelatedField(slug_field="slug", queryset=Branch.objects.filter(is_active=True))
    kind = serializers.ChoiceField(choices=AccessRequest.KINDS)
    note = serializers.CharField(max_length=NOTE_LENGTH, allow_blank=True, required=False)
    # Hidden on the form; people leave it empty and robots fill it in.
    website = serializers.CharField(allow_blank=True, required=False)

    def validate_phone(self, value):
        if not PHONE.fullmatch(value) or sum(c.isdigit() for c in value) < 6:
            raise serializers.ValidationError("Please give a phone number, using only numbers, spaces and + - ( ).")
        return value


class RequestAccessView(APIView):
    authentication_classes = []
    permission_classes = [FromWebsiteServer]
    throttle_classes = [AskThrottle]

    def post(self, request):
        serializer = AskSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        values = dict(serializer.validated_data)
        if values.pop("website", ""):
            return Response({"received": True}, status=status.HTTP_202_ACCEPTED)
        # Asking again while waiting keeps the first request.
        if not AccessRequest.objects.filter(email__iexact=values["email"], status="waiting").exists():
            AccessRequest.objects.create(**values)
        return Response({"received": True}, status=status.HTTP_202_ACCEPTED)


# --- Reviewing ---

def visible_requests(viewer):
    if viewer.is_superuser:
        return AccessRequest.objects.all()
    if is_branch_admin(viewer):
        return AccessRequest.objects.filter(branch_id=viewer.branch_id, kind="staff")
    return AccessRequest.objects.none()


class RequestSerializer(serializers.ModelSerializer):
    branch = serializers.SlugRelatedField(slug_field="slug", read_only=True)
    branch_name = serializers.CharField(source="branch.name", read_only=True)
    kind_label = serializers.CharField(source="get_kind_display", read_only=True)
    decided_by_name = serializers.SerializerMethodField()
    account_username = serializers.CharField(source="account.username", read_only=True, default="")
    existing_account = serializers.SerializerMethodField()

    class Meta:
        model = AccessRequest
        fields = [
            "id", "full_name", "email", "phone", "branch", "branch_name", "kind", "kind_label", "note",
            "status", "reason", "decided_by_name", "decided_at", "account_username", "existing_account", "created_at",
        ]
        read_only_fields = fields

    def get_decided_by_name(self, obj):
        return obj.decided_by.get_username() if obj.decided_by else ""

    def get_existing_account(self, obj):
        match = User.objects.filter(email__iexact=obj.email).values_list("username", flat=True).first()
        return match or ""


class ApproveSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150, validators=[UnicodeUsernameValidator()])
    role = serializers.ChoiceField(choices=MANAGED_ROLES, required=False)
    branch = serializers.SlugRelatedField(
        slug_field="slug", queryset=Branch.objects.filter(is_active=True), required=False,
    )
    # A minister's id, or "new" to make their profile from the request.
    minister = serializers.CharField(required=False, allow_blank=True)

    def validate_username(self, value):
        if User.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError("Someone already has this username.")
        return value

    def validate(self, attrs):
        request, viewer = self.context["access_request"], self.context["viewer"]
        if not viewer.is_superuser:
            # A minister's account adds their own branch's content editors only.
            return {"username": attrs["username"], "role": "content_editor", "branch": viewer.branch, "minister": None}
        branch = attrs.get("branch") or request.branch
        if request.kind == "minister":
            choice = (attrs.get("minister") or "").strip()
            if choice == "new":
                minister = "new"
            elif choice.isdigit():
                minister = Minister.objects.filter(pk=int(choice), branch=branch, account__isnull=True).first()
                if minister is None:
                    raise serializers.ValidationError({"minister": [
                        "Choose a minister of this branch who doesn't have an account yet.",
                    ]})
            else:
                raise serializers.ValidationError({"minister": ["Choose their minister profile, or make a new one."]})
            # Decision D1: a minister's account is a Branch Admin of their branch.
            return {"username": attrs["username"], "role": "branch_admin", "branch": branch, "minister": minister}
        if "role" not in attrs:
            raise serializers.ValidationError({"role": ["Please choose a role."]})
        return {"username": attrs["username"], "role": attrs["role"], "branch": branch, "minister": None}


class AlreadyDecided(APIException):
    status_code = status.HTTP_409_CONFLICT
    default_detail = "This request has already been decided."


class StaffRequestViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = RequestSerializer
    permission_classes = [IsStaff]

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        if not (request.user.is_superuser or is_branch_admin(request.user)):
            raise PermissionDenied("Only superusers and ministers review access requests.")

    def get_queryset(self):
        rows = visible_requests(self.request.user).select_related("branch", "decided_by", "account")
        wanted = self.request.query_params.get("status", "")
        if wanted in dict(AccessRequest.STATUSES):
            rows = rows.filter(status=wanted)
        return rows

    def waiting_request(self):
        with transaction.atomic():
            found = self.get_queryset().select_for_update(of=("self",)).filter(pk=self.kwargs["pk"]).first()
        if found is None:
            raise NotFound()
        if found.status != "waiting":
            raise AlreadyDecided()
        return found

    @action(detail=True, methods=["post"])
    def approve(self, request, *args, **kwargs):
        access = self.waiting_request()
        serializer = ApproveSerializer(data=request.data, context={"access_request": access, "viewer": request.user})
        serializer.is_valid(raise_exception=True)
        values = serializer.validated_data
        first, _, last = access.full_name.partition(" ")
        with transaction.atomic():
            # Checked again inside the transaction, in case two people approve at once.
            if AccessRequest.objects.select_for_update().get(pk=access.pk).status != "waiting":
                raise AlreadyDecided()
            account = User(
                username=values["username"], first_name=first[:150], last_name=last[:150], email=access.email,
                role=values["role"], branch=values["branch"], is_staff=True, is_active=True, is_superuser=False,
            )
            account.set_unusable_password()
            account.save()
            minister = values["minister"]
            if minister == "new":
                minister = Minister.objects.create(branch=values["branch"], name=access.full_name)
            if minister is not None:
                link_minister(account, minister)
            AccessRequest.objects.filter(pk=access.pk).update(
                status="approved", decided_by=request.user, decided_at=timezone.now(), account=account,
            )
            record(request.user, "requests", "approved", branch=access.branch, target=access.full_name, target_id=access.pk)
            record(request.user, "people", "added", branch=account.branch, target=account.username, target_id=account.pk)
            token = make_link(account, made_by=request.user)
        access.refresh_from_db()
        return Response(
            {**self.get_serializer(access).data, "link_token": token, "username": account.username},
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["post"], url_path="turn-down")
    def turn_down(self, request, *args, **kwargs):
        access = self.waiting_request()
        reason = str(request.data.get("reason", "")).strip()
        if len(reason) > NOTE_LENGTH:
            raise serializers.ValidationError({"reason": [f"Please keep this to {NOTE_LENGTH} characters."]})
        AccessRequest.objects.filter(pk=access.pk, status="waiting").update(
            status="turned_down", reason=reason, decided_by=request.user, decided_at=timezone.now(),
        )
        record(request.user, "requests", "turned down", branch=access.branch, target=access.full_name, target_id=access.pk)
        access.refresh_from_db()
        return Response(self.get_serializer(access).data)


# --- Opening a set-password link ---

class LinkView(APIView):
    authentication_classes = []
    permission_classes = [FromWebsiteServer]
    throttle_classes = [LinkThrottle]

    def link(self, request):
        found = usable_link(request.data.get("token"))
        if found is None:
            raise NotFound(LINK_GONE)
        return found


class PasswordLinkCheckView(LinkView):
    def post(self, request):
        user = self.link(request).user
        return Response({"username": user.username, "first_name": user.first_name})


class PasswordLinkUseView(LinkView):
    def post(self, request):
        found = self.link(request)
        password = request.data.get("password")
        if not isinstance(password, str) or not password:
            raise serializers.ValidationError({"password": ["Please choose a password."]})
        try:
            validate_password(password, found.user)
        except DjangoValidationError as exc:
            raise serializers.ValidationError({"password": list(exc.messages)})
        if not use_link(found, password):
            raise NotFound(LINK_GONE)
        return Response({"username": found.user.username})
