from django.contrib import admin
from django.core.exceptions import PermissionDenied

from .models import GivingRecord


@admin.register(GivingRecord)
class GivingRecordAdmin(admin.ModelAdmin):
    list_display = ('giving_type', 'amount', 'currency', 'branch', 'member_name', 'payment_method', 'status', 'created_at')
    search_fields = ('member_name', 'member_phone', 'reference_number')
    list_filter = ('giving_type', 'payment_method', 'status', 'branch')

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        if request.user.is_superuser:
            return qs
        if not request.user.groups.filter(name='finance_admin').exists():
            return qs.none()
        return qs.filter(branch_id__in=request.user.branch_set.values_list('id', flat=True) if hasattr(request.user, 'branch_set') else [])
