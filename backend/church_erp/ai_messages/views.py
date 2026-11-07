from django.utils import timezone
from rest_framework import permissions, viewsets
from church_erp.core.api_mixins import BranchScopedViewSetMixin, MinisterBranchMixin
from church_erp.ai_messages.models import DailyMessage
from church_erp.ai_messages.serializers import DailyMessageSerializer


# Read-only, and only published messages whose day has come. Staff write and
# publish them through the dashboard's own address in staff_messages.py.
class DailyMessageViewSet(MinisterBranchMixin, BranchScopedViewSetMixin, viewsets.ReadOnlyModelViewSet):
    queryset = DailyMessage.objects.select_related('minister')
    serializer_class = DailyMessageSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        return (
            super().get_queryset()
            .filter(status='published', date__lte=timezone.localdate())
            # The home page shows the first one: today's newest.
            .order_by('-date', '-published_at', '-pk')
        )
