from rest_framework import viewsets, permissions
from church_erp.finance.models import GivingRecord
from church_erp.finance.serializers import GivingRecordSerializer


class IsFinanceOrSuperAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and request.user.role in ('finance_admin', 'super_admin')
        )


class GivingRecordViewSet(viewsets.ModelViewSet):
    queryset = GivingRecord.objects.all()
    serializer_class = GivingRecordSerializer
    permission_classes = [IsFinanceOrSuperAdmin]
