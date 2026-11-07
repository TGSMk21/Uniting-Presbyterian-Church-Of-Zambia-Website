"""Change history for the dashboard (AGENT_EXECUTION_PLAN.md, Task 5.4).

`record` is called after each successful change made through the staff API.
Only names are kept, never the values, which may be private."""
from rest_framework import permissions, serializers, viewsets

from church_erp.accounts.auth_views import IsStaff

from .models import StaffChange


def record(user, section, action, *, branch=None, target="", target_id="", changes=()):
    StaffChange.objects.create(
        user=user,
        username=user.get_username(),
        branch=branch,
        section=section,
        action=action,
        target=str(target or "")[:300],
        target_id=str(target_id or "")[:40],
        changes=sorted(changes),
    )


def editable_names(serializer):
    """The fields a person can set through this serializer."""
    return [name for name, field in serializer.fields.items() if not field.read_only and not field.write_only]


def changed(before, after, names):
    return sorted(name for name in names if before.get(name) != after.get(name))


def row_title(data):
    return data.get("title") or data.get("name") or data.get("username") or ""


class IsSuperuser(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_superuser)


class StaffChangeSerializer(serializers.ModelSerializer):
    branch = serializers.SlugRelatedField(slug_field="slug", read_only=True)
    branch_name = serializers.CharField(source="branch.name", read_only=True, default="")

    class Meta:
        model = StaffChange
        fields = ["id", "at", "username", "branch", "branch_name", "section", "action", "target", "target_id", "changes"]


class StaffChangeViewSet(viewsets.ReadOnlyModelViewSet):
    """Superusers read the history; nobody changes it through the API."""
    serializer_class = StaffChangeSerializer
    permission_classes = [IsStaff, IsSuperuser]

    def get_queryset(self):
        rows = StaffChange.objects.select_related("branch").order_by("-at", "-pk")
        params = self.request.query_params
        if params.get("branch"):
            rows = rows.filter(branch__slug=params["branch"])
        if params.get("person"):
            rows = rows.filter(username__iexact=params["person"])
        if params.get("section"):
            rows = rows.filter(section=params["section"])
        return rows
