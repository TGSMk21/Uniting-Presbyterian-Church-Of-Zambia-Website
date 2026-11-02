from rest_framework import viewsets, permissions
from church_erp.core.api_mixins import BranchScopedViewSetMixin
from church_erp.finance.models import GivingRecord
from church_erp.finance.serializers import GivingRecordSerializer


class IsFinanceOrSuperAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and (request.user.is_superuser
                 or request.user.role in ('finance_admin', 'super_admin'))
        )


class GivingRecordViewSet(BranchScopedViewSetMixin, viewsets.ModelViewSet):
    queryset = GivingRecord.objects.all()
    serializer_class = GivingRecordSerializer
    permission_classes = [IsFinanceOrSuperAdmin]
    # Records are voided (status='void'), never deleted.
    http_method_names = ['get', 'post', 'put', 'patch', 'head', 'options']

    def get_queryset(self):
        # Giving data is never public: reads are branch-scoped too.
        qs = super().get_queryset()
        user = self.request.user
        if user.is_superuser:
            return qs
        return qs.filter(branch_id=user.branch_id)

    def perform_create(self, serializer):
        self.check_branch(serializer)
        serializer.save(recorded_by=self.request.user)
