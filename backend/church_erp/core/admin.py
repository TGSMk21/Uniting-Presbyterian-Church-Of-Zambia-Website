from django.contrib import admin

from .admin_mixins import BranchScopedAdmin
from .models import Branch, Minister, ServiceTime


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
    list_display = ('name', 'branch', 'created_at')
    search_fields = ('name', 'branch__name')
    list_filter = ('branch',)
