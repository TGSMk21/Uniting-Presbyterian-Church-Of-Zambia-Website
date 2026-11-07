from django.contrib import admin
from django.contrib.admin.models import LogEntry

from .admin_mixins import BranchScopedAdmin
from .models import Branch, Minister, ServiceTime


@admin.register(LogEntry)
class ActivityLogAdmin(admin.ModelAdmin):
    """Who changed what through the admin. Superusers can read it; nobody can edit it."""

    list_display = ("action_time", "user", "action", "content_type", "object_repr")
    list_filter = ("action_flag", "content_type")
    search_fields = ("object_repr", "change_message", "user__username")
    date_hierarchy = "action_time"
    ordering = ("-action_time",)
    list_select_related = ("user", "content_type")

    @admin.display(description="Action", ordering="action_flag")
    def action(self, entry):
        if entry.is_addition():
            return "Added"
        if entry.is_change():
            return "Changed"
        return "Deleted"

    def has_module_permission(self, request):
        return request.user.is_superuser

    def has_view_permission(self, request, obj=None):
        return request.user.is_superuser

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


class MinisterInline(admin.TabularInline):
    model = Minister
    extra = 1


class ServiceTimeInline(admin.TabularInline):
    model = ServiceTime
    extra = 1


@admin.register(Branch)
class BranchAdmin(BranchScopedAdmin):
    branch_lookup = 'id'
    branch_field = None
    list_display = ('name', 'slug', 'contact_email', 'is_active', 'created_at')
    prepopulated_fields = {'slug': ('name',)}
    search_fields = ('name', 'contact_email')
    list_filter = ('is_active',)
    inlines = [ServiceTimeInline, MinisterInline]

    def has_add_permission(self, request):
        return request.user.is_superuser

    def has_delete_permission(self, request, obj=None):
        return request.user.is_superuser


@admin.register(Minister)
class MinisterAdmin(BranchScopedAdmin):
    list_display = ('name', 'branch', 'order', 'account', 'created_at')
    search_fields = ('name', 'branch__name')
    list_filter = ('branch',)

    def get_readonly_fields(self, request, obj=None):
        # Which login a minister uses is the developer's decision (Task 7.1).
        fields = list(super().get_readonly_fields(request, obj))
        if not request.user.is_superuser:
            fields.append('account')
        return fields
