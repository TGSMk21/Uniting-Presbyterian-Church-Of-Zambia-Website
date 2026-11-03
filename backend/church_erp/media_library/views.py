from rest_framework import viewsets, permissions
from church_erp.core.api_mixins import BranchScopedViewSetMixin
from church_erp.media_library.models import MediaAsset
from church_erp.media_library.serializers import MediaAssetSerializer


class IsBranchStaff(permissions.BasePermission):
    """The media library is internal: superusers, or staff of a branch."""
    def has_permission(self, request, view):
        user = request.user
        return bool(
            user and user.is_authenticated
            and (user.is_superuser or (user.is_staff and user.branch_id))
        )


class MediaAssetViewSet(BranchScopedViewSetMixin, viewsets.ModelViewSet):
    queryset = MediaAsset.objects.all()
    serializer_class = MediaAssetSerializer
    permission_classes = [IsBranchStaff]
    filterset_fields = ['file_type', 'tags']  # e.g. ?file_type=image&tags=3

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if user.is_superuser:
            return qs
        return qs.filter(branch_id=user.branch_id)

    def perform_create(self, serializer):
        self.check_branch(serializer)
        serializer.save(uploaded_by=self.request.user)
