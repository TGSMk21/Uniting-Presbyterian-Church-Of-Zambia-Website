"""Managing staff from the dashboard (AGENT_EXECUTION_PLAN.md, Task 5.4).

- Branch admins see their branch's admins and content editors, and add,
  change, suspend and restore its content editors.
- Superusers see everyone and manage every branch's admins and editors.
- Superusers, finance and national roles, and your own account stay in the
  Django admin, so nobody can lock themselves out or hand out more power here.
- New accounts and password resets get a single-use link to choose a password
  (Task 7.2), shown once to whoever made it; nobody else ever knows the password.
"""

from django.contrib.auth.validators import UnicodeUsernameValidator
from django.db import transaction
from rest_framework import serializers, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response

from church_erp.core.changes import changed, editable_names, record
from church_erp.core.models import Branch, Minister, account_link_problem

from . import two_factor
from .auth_views import IsStaff
from .models import User
from .password_links import make_link

# The roles given out here.
MANAGED_ROLES = ("branch_admin", "content_editor")
def linked_minister(person):
    try:
        return person.minister_profile
    except Minister.DoesNotExist:
        return None


def link_minister(person, minister):
    """Make `minister` (or nobody, for None) the minister `person` signs in for."""
    current = linked_minister(person)
    if current is not None and current != minister:
        Minister.objects.filter(pk=current.pk).update(account=None)
    if minister is not None:
        Minister.objects.filter(pk=minister.pk).update(account=person)
    # Read the link again next time, not the one cached before this change.
    person._state.fields_cache.pop("minister_profile", None)


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
    # The minister this login belongs to (Task 7.1); superusers set it.
    minister = serializers.PrimaryKeyRelatedField(
        queryset=Minister.objects.select_related("account"), allow_null=True, required=False, write_only=True,
    )
    minister_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id", "username", "first_name", "last_name", "email", "role", "role_label", "branch", "branch_name",
            "is_active", "must_change_password", "two_factor_enabled", "last_login", "date_joined", "can_manage",
            "minister", "minister_name",
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
            self.fields.pop("minister")

    def to_representation(self, person):
        data = super().to_representation(person)
        data["role"] = person.role  # also roles not given out here, such as finance
        profile = linked_minister(person)
        data["minister"] = profile.pk if profile else None
        return data

    def get_role_label(self, person):
        return "Superuser" if person.is_superuser else person.get_role_display()

    def get_two_factor_enabled(self, person):
        return two_factor.has_two_factor(person)

    def get_minister_name(self, person):
        profile = linked_minister(person)
        return profile.name if profile else ""

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

        # A linked account stays a Branch Admin of its minister's branch (decision D1).
        current = None if creating else linked_minister(self.instance)
        minister = attrs["minister"] if "minister" in attrs else current
        if minister is not None:
            if minister.account_id and minister.account_id != getattr(self.instance, "pk", None):
                raise serializers.ValidationError({"minister": ["This minister already has an account."]})
            probe = User(role=role, branch=branch, is_superuser=bool(getattr(self.instance, "is_superuser", False)))
            problem = account_link_problem(probe, minister.branch_id)
            if problem:
                if minister == current:
                    problem = f"This account is {minister.name}'s. Unlink it from them first, in the same change."
                raise serializers.ValidationError({"minister": [problem]})
        return attrs

    def save(self, **kwargs):
        linking = "minister" in self.validated_data
        minister = self.validated_data.pop("minister", None)
        with transaction.atomic():
            person = super().save(**kwargs)
            if linking:
                link_minister(person, minister)
        return person


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
        minister = values.pop("minister", None)
        if not viewer.is_superuser:
            values.update(role="content_editor", branch=viewer.branch)
        person = User(**values, is_staff=True, is_active=True, is_superuser=False)
        person.set_unusable_password()
        with transaction.atomic():
            person.save()
            if minister is not None:
                link_minister(person, minister)
            self.note(person, "added")
            token = make_link(person, made_by=viewer)
        # Shown once, for them to pass on; only its hash is kept.
        return Response({**self.get_serializer(person).data, "link_token": token}, status=201)

    def partial_update(self, request, *args, **kwargs):
        person = self.managed()
        serializer = self.get_serializer(person, data=request.data, partial=True)
        before, names = dict(self.get_serializer(person).data), editable_names(serializer)
        if "minister" in serializer.fields:
            # Written as an ID and shown back, so the history can compare it too.
            names.append("minister")
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
        with transaction.atomic():
            # The old password stops working now; they choose a new one from the link.
            person.set_unusable_password()
            person.must_change_password = False
            person.save(update_fields=["password", "must_change_password"])
            two_factor.end_sessions(person)
            self.note(person, "password reset")
            token = make_link(person, made_by=request.user)
        return self.answer(person, link_token=token)

    @action(detail=True, methods=["post"], url_path="reset-two-factor")
    def reset_two_factor(self, request, *args, **kwargs):
        if not request.user.is_superuser:
            raise PermissionDenied("Only superusers can reset two-step login.")
        person = self.managed()
        two_factor.reset_two_factor(person)
        self.note(person, "two-step login reset")
        return self.answer(person)
