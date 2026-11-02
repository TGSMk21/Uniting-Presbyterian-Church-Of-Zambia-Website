from django.contrib import admin

from church_erp.core.admin_mixins import BranchScopedAdmin, FinanceRoleRequired

from .models import GivingRecord


@admin.register(GivingRecord)
class GivingRecordAdmin(FinanceRoleRequired, BranchScopedAdmin):
    list_display = ('giving_type', 'amount', 'currency', 'branch', 'member_name', 'payment_method', 'status', 'created_at')
    search_fields = ('member_name', 'member_phone', 'reference_number')
    list_filter = ('giving_type', 'payment_method', 'status', 'branch')
    readonly_fields = ('recorded_by',)

    def save_model(self, request, obj, form, change):
        if not change:
            obj.recorded_by = request.user
        super().save_model(request, obj, form, change)
