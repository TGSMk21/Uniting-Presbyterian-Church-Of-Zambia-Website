from django.contrib import admin

from .models import Branch


def _own_branch_choices(model, branch_id):
    """Rows of `model` belonging to `branch_id`, or None if `model` isn't
    branch-owned (then the field's choices are left alone)."""
    if model is Branch:
        return Branch.objects.filter(id=branch_id)
    if any(f.name == 'branch' for f in model._meta.fields):
        return model._default_manager.filter(branch_id=branch_id)
    return None


class BranchScopedAdmin(admin.ModelAdmin):
    """Restricts the admin to the logged-in user's branch, unless the user
    is a superuser.

    `branch_lookup`: ORM path from this model to a Branch id (default
    'branch_id'; use e.g. 'minister__branch_id' when branch is reached
    through a FK).
    `branch_field`: name of this model's direct Branch FK, which is locked
    to the user's branch on add/change. Set to None when the model has no
    direct Branch FK (e.g. Branch itself, DailyMessage)."""
    branch_lookup = 'branch_id'
    branch_field = 'branch'

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        if request.user.is_superuser:
            return qs
        if not getattr(request.user, 'branch_id', None):
            return qs.none()
        return qs.filter(**{self.branch_lookup: request.user.branch_id})

    def _limit_choices(self, db_field, request, kwargs):
        if not request.user.is_superuser:
            choices = _own_branch_choices(db_field.related_model, request.user.branch_id)
            if choices is not None:
                kwargs['queryset'] = choices

    def formfield_for_foreignkey(self, db_field, request, **kwargs):
        self._limit_choices(db_field, request, kwargs)
        return super().formfield_for_foreignkey(db_field, request, **kwargs)

    def formfield_for_manytomany(self, db_field, request, **kwargs):
        self._limit_choices(db_field, request, kwargs)
        return super().formfield_for_manytomany(db_field, request, **kwargs)

    def save_model(self, request, obj, form, change):
        if self.branch_field and not request.user.is_superuser:
            setattr(obj, f'{self.branch_field}_id', request.user.branch_id)
        super().save_model(request, obj, form, change)


class FinanceRoleRequired:
    """Mix in before BranchScopedAdmin for finance models. Restricts the
    whole admin module to superusers and users with role='finance_admin'."""
    def has_module_permission(self, request):
        return request.user.is_superuser or getattr(request.user, 'role', None) == 'finance_admin'

    def has_view_permission(self, request, obj=None):
        return self.has_module_permission(request)

    def has_add_permission(self, request):
        return self.has_module_permission(request)

    def has_change_permission(self, request, obj=None):
        return self.has_module_permission(request)

    def has_delete_permission(self, request, obj=None):
        return False  # financial records are never hard-deleted via admin
