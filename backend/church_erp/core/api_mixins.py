from rest_framework import permissions
from rest_framework.exceptions import PermissionDenied


class IsBranchStaffOrReadOnly(permissions.BasePermission):
    """Reads are public; writes need a superuser, or a staff user who
    belongs to a branch."""
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        user = request.user
        return bool(
            user and user.is_authenticated
            and (user.is_superuser or (user.is_staff and user.branch_id))
        )


class BranchScopedViewSetMixin:
    """Branch scoping for API viewsets, mirroring BranchScopedAdmin.

    - `?branch=<slug>` filters any request (public listing).
    - Non-superusers can only write objects of their own branch: other
      branches' objects are invisible (404) to unsafe methods, and a
      create/update that would place an object in another branch is 403.

    `branch_lookup`: ORM path from this model to a Branch id.
    `branch_slug_lookup`: ORM path from this model to a Branch slug."""
    branch_lookup = 'branch_id'
    branch_slug_lookup = 'branch__slug'

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if self.request.method not in permissions.SAFE_METHODS and not user.is_superuser:
            qs = qs.filter(**{self.branch_lookup: user.branch_id})
        slug = self.request.query_params.get('branch')
        if slug:
            qs = qs.filter(**{self.branch_slug_lookup: slug})
        return qs

    def branch_id_for(self, validated_data, instance=None):
        """Branch id the object will belong to after this write."""
        branch = validated_data.get('branch', getattr(instance, 'branch', None))
        return branch.id if branch else None

    def check_branch(self, serializer):
        user = self.request.user
        if user.is_superuser:
            return
        target = self.branch_id_for(serializer.validated_data, serializer.instance)
        if target != user.branch_id:
            raise PermissionDenied("You can only manage records of your own branch.")

    def perform_create(self, serializer):
        self.check_branch(serializer)
        serializer.save()

    def perform_update(self, serializer):
        self.check_branch(serializer)
        serializer.save()


class MinisterBranchMixin:
    """For models that reach their branch through `minister`."""
    branch_lookup = 'minister__branch_id'
    branch_slug_lookup = 'minister__branch__slug'

    def branch_id_for(self, validated_data, instance=None):
        minister = validated_data.get('minister', getattr(instance, 'minister', None))
        return minister.branch_id if minister else None
