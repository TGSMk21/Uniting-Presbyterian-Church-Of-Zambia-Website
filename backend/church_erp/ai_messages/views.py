from django.db.models import Q
from rest_framework import viewsets
from church_erp.core.api_mixins import (
    BranchScopedViewSetMixin,
    IsBranchStaffOrReadOnly,
    MinisterBranchMixin,
)
from church_erp.ai_messages.models import DailyMessage
from church_erp.ai_messages.serializers import DailyMessageSerializer


class DailyMessageViewSet(MinisterBranchMixin, BranchScopedViewSetMixin, viewsets.ModelViewSet):
    queryset = DailyMessage.objects.select_related('minister')
    serializer_class = DailyMessageSerializer
    permission_classes = [IsBranchStaffOrReadOnly]

    def get_queryset(self):
        # The public only ever sees published messages; staff also see their
        # own branch's drafts and rejected messages.
        qs = super().get_queryset()
        user = self.request.user
        if user.is_superuser:
            return qs
        visible = Q(status='published')
        if user.is_staff and user.branch_id:
            visible |= Q(minister__branch_id=user.branch_id)
        return qs.filter(visible)
