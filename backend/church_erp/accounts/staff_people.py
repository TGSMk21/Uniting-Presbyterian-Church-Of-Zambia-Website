"""Managing staff from the dashboard (AGENT_EXECUTION_PLAN.md, Task 5.4).

- Branch admins see their branch's admins and content editors, and add,
  change, suspend and restore its content editors.
- Superusers see everyone and manage every branch's admins and editors.
- Superusers, finance and national roles, and your own account stay in the
  Django admin, so nobody can lock themselves out or hand out more power here.
"""
import secrets

from django.contrib.auth.validators import UnicodeUsernameValidator
from django.db import transaction
from rest_framework import serializers, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response

from church_erp.core.changes import changed, editable_names, record
from church_erp.core.models import Branch

from . import two_factor
from .auth_views import IsStaff
from .models import User

# The roles given out here.
MANAGED_ROLES = ("branch_admin", "content_editor")
# Easy to read out or copy: no 0/O, 1/l/I.
PASSWORD_LETTERS = "abcdefghjkmnpqrstuvwxyz23456789"


def temporary_password():
    """Four groups of four, such as k7dm-q2xa-9fph-wr3c. They choose their own when they sign in."""
    return "-".join("".join(secrets.choice(PASSWORD_LETTERS) for _ in range(4)) for _ in range(4))


def is_branch_admin(user):
    return not user.is_superuser and user.role == "branch_admin" and bool(user.branch_id)


def visible_people(viewer):
    if viewer.is_superuser:
        return User.objects.all()
    if is_branch_admin(viewer):
        return User.objects.filter(branch_id=viewer.branch_id, is_superuser=False, role__in=MANAGED_ROLES)
    return User.objects.none()


def can_manage(viewer, person):
    if person.is_superuser or person.pk == viewer.pk or person.role not in MANAGED_ROLES:
        return False
    if viewer.is_superuser:
        return True
    return is_branch_admin(viewer) and person.branch_id == viewer.branch_id and person.role == "content_editor"


class PersonSerializer(serializers.ModelSerializer):
    username = serializers.CharField(max_length=150, validators=[UnicodeUsernameValidator()])
    email = serializers.EmailField(allow_blank=True, required=False)
    role = serializers.ChoiceField(choices=MANAGED_ROLES, required=False)
    branch = serializers.SlugRelatedField(
        slug_field="slug", queryset=Branch.objects.filter(is_active=True), allow_null=True, required=False,
    )
    branch_name = serializers.CharField(source="branch.name", read_only=True, default="")
    role_label = serializers.SerializerMethodField()
    two_factor_enabled = serializers.SerializerMethodField()
    can_manage = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id", "username", "first_name", "last_name", "email", "role", "role_label", "branch", "branch_name",
            "is_active", "must_change_password", "two_factor_enabled", "last_login", "date_joined", "can_manage",
        ]
        read_only_fields = ["is_active", "must_change_password", "last_login", "date_joined"]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        viewer = self.context["request"].user
        if isinstance(self.instance, User):
            # Usernames are how people sign in, so they stay as they were made.
            self.fields["username"].read_only = True
        if not viewer.is_superuser:
            # A branch admin's people are always their branch's content editors.
            self.fields["role"].read_only = True
            self.fields["branch"].read_only = True

    def to_representation(self, person):
        data = super().to_representation(person)
        data["role"] = person.role  # also roles not given out here, such as finance
        return data

    def get_role_label(self, person):
        return "Superuser" if person.is_superuser else person.get_role_display()

    def get_two_factor_enabled(self, person):
        return two_factor.has_two_factor(person)

    def get_can_manage(self, person):
        return can_manage(self.context["request"].user, person)

    def validate_username(self, value):
        if User.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError("Someone already has this username.")
        return value

    def validate(self, attrs):
        if not self.context["request"].user.is_superuser:
            return attrs
        creating = self.instance is None
        role = attrs.get("role", None if creating else self.instance.role)
        branch = attrs.get("branch", None if creating else self.instance.branch)
        if creating and "role" not in attrs:
            raise serializers.ValidationError({"role": ["Please choose a role."]})
        if (creating or "role" in attrs or "branch" in attrs) and role in MANAGED_ROLES and branch is None:
            raise serializers.ValidationError({"branch": ["Please choose their branch."]})
        return attrs


class StaffPeopleViewSet(viewsets.ModelViewSet):
    serializer_class = PersonSerializer
    permission_classes = [IsStaff]
    http_method_names = ["get", "post", "patch", "head", "options"]

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        if not (request.user.is_superuser or is_branch_admin(request.user)):
            raise PermissionDenied("Only branch admins and superusers manage staff.")

    def get_queryset(self):
        people = visible_people(self.request.user).select_related("branch").order_by("branch__name", "username")
        branch = self.request.query_params.get("branch", "").strip()
        if branch and self.action == "list":
            people = people.filter(branch__slug=branch)
        return people

    def managed(self):
        person = self.get_object()
        if not can_manage(self.request.user, person):
            raise PermissionDenied("You can't change this person's account here.")
        return person

    def answer(self, person, **extra):
        return Response({**self.get_serializer(person).data, **extra})

    def note(self, person, action, changes=()):
        record(self.request.user, "people", action, branch=person.branch, target=person.username,
               target_id=person.pk, changes=changes)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        viewer = request.user
        values = dict(serializer.validated_data)
        if not viewer.is_superuser:
            values.update(role="content_editor", branch=viewer.branch)
        password = temporary_password()
        person = User(**values, is_staff=True, is_active=True, is_superuser=False, must_change_password=True)
        person.set_password(password)
        person.save()
        self.note(person, "added")
        # Shown once, for them to pass on; only its hash is kept.
        return Response({**self.get_serializer(person).data, "temporary_password": password}, status=201)

    def partial_update(self, request, *args, **kwargs):
        person = self.managed()
        serializer = self.get_serializer(person, data=request.data, partial=True)
        before, names = dict(self.get_serializer(person).data), editable_names(serializer)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        after = self.get_serializer(person).data
        changes = changed(before, after, names)
        if changes:
            self.note(person, "changed", changes)
        return Response(after)

    def update(self, request, *args, **kwargs):
        if not kwargs.get("partial"):
            return self.http_method_not_allowed(request, *args, **kwargs)
        return self.partial_update(request, *args, **kwargs)

    @action(detail=True, methods=["post"])
    def suspend(self, request, *args, **kwargs):
        person = self.managed()
        with transaction.atomic():
            person.is_active = False
            person.save(update_fields=["is_active"])
            # Their access tokens stop working at once because the account is
            # inactive; their refresh tokens are cancelled here.
            two_factor.end_sessions(person)
        self.note(person, "suspended")
        return self.answer(person)

    @action(detail=True, methods=["post"])
    def restore(self, request, *args, **kwargs):
        person = self.managed()
        person.is_active = True
        person.save(update_fields=["is_active"])
        self.note(person, "restored")
        return self.answer(person)

    @action(detail=True, methods=["post"], url_path="reset-password")
    def reset_password(self, request, *args, **kwargs):
        person = self.managed()
        password = temporary_password()
        with transaction.atomic():
            person.set_password(password)
            person.must_change_password = True
            person.save(update_fields=["password", "must_change_password"])
            two_factor.end_sessions(person)
        self.note(person, "password reset")
        return self.answer(person, temporary_password=password)

    @action(detail=True, methods=["post"], url_path="reset-two-factor")
    def reset_two_factor(self, request, *args, **kwargs):
        if not request.user.is_superuser:
            raise PermissionDenied("Only superusers can reset two-step login.")
        person = self.managed()
        two_factor.reset_two_factor(person)
        self.note(person, "two-step login reset")
        return self.answer(person)
