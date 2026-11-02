from rest_framework import viewsets, permissions
from church_erp.media_library.models import MediaAsset
from church_erp.media_library.serializers import MediaAssetSerializer


class IsAuthenticatedStaffWrite(permissions.BasePermission):
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.method in permissions.SAFE_METHODS:
            return True
        return request.user.is_staff


class MediaAssetViewSet(viewsets.ModelViewSet):
    queryset = MediaAsset.objects.all()
    serializer_class = MediaAssetSerializer
    permission_classes = [IsAuthenticatedStaffWrite]

    def get_queryset(self):
        qs = MediaAsset.objects.all()
        branch_slug = self.request.query_params.get('branch')
        if branch_slug:
            qs = qs.filter(branch__slug=branch_slug)
        return qs
