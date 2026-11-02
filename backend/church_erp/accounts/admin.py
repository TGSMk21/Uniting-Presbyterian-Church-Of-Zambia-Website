from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import User
from .roles import sync_role_group

# Roles a non-superuser may hold or grant. National and finance roles are
# assigned by superusers only.
BRANCH_ROLES = ('branch_admin', 'content_editor')
PRIVILEGE_FIELDS = ('is_superuser', 'is_staff', 'groups', 'user_permissions', 'branch')


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ('username', 'email', 'branch', 'role', 'is_active')
    list_filter = ('role', 'branch', 'is_active')
    search_fields = ('username', 'email', 'first_name', 'last_name')
    fieldsets = BaseUserAdmin.fieldsets + (
        ('Branch & Role', {'fields': ('branch', 'role')}),
    )

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        if request.user.is_superuser:
            return qs
        if not request.user.branch_id:
            return qs.none()
        # Hiding more privileged users also blocks resetting their passwords.
        return qs.filter(
            branch_id=request.user.branch_id,
            is_superuser=False,
            role__in=BRANCH_ROLES,
        )

    def get_readonly_fields(self, request, obj=None):
        readonly = super().get_readonly_fields(request, obj)
        if request.user.is_superuser:
            return readonly
        return tuple(readonly) + PRIVILEGE_FIELDS

    def formfield_for_choice_field(self, db_field, request, **kwargs):
        if db_field.name == 'role' and not request.user.is_superuser:
            kwargs['choices'] = [c for c in db_field.choices if c[0] in BRANCH_ROLES]
        return super().formfield_for_choice_field(db_field, request, **kwargs)

    def save_model(self, request, obj, form, change):
        if not change:
            # Every role is a staff role, so people added here can log in
            # straight away; a superuser can still revoke it later.
            obj.is_staff = True
            if not request.user.is_superuser:
                obj.branch_id = request.user.branch_id
        super().save_model(request, obj, form, change)

    def save_related(self, request, form, formsets, change):
        # The form's groups field is saved after the user; restore the role group.
        super().save_related(request, form, formsets, change)
        sync_role_group(form.instance)
