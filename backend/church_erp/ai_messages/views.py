from rest_framework import viewsets, permissions
from church_erp.ai_messages.models import DailyMessage
from church_erp.ai_messages.serializers import DailyMessageSerializer


class IsStaffOrReadOnly(permissions.BasePermission):
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        return request.user and request.user.is_staff


class DailyMessageViewSet(viewsets.ModelViewSet):
    queryset = DailyMessage.objects.all()
    serializer_class = DailyMessageSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly, IsStaffOrReadOnly]

    def get_queryset(self):
        user = self.request.user
        if user.is_staff:
            qs = DailyMessage.objects.all()
        else:
            qs = DailyMessage.objects.filter(status='published')
        branch_slug = self.request.query_params.get('branch')
        if branch_slug:
            qs = qs.filter(minister__branch__slug=branch_slug)
        return qs
