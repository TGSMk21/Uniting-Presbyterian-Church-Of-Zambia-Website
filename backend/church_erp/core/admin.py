from django.contrib import admin

from .models import Branch, Minister


class MinisterInline(admin.TabularInline):
    model = Minister
    extra = 1


@admin.register(Branch)
class BranchAdmin(admin.ModelAdmin):
    list_display = ('name', 'slug', 'contact_email', 'is_active', 'created_at')
    prepopulated_fields = {'slug': ('name',)}
    search_fields = ('name', 'contact_email')
    list_filter = ('is_active',)
    inlines = [MinisterInline]

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        if request.user.is_superuser:
            return qs
        return qs.filter(id__in=request.user.branch_set.values_list('id', flat=True) if hasattr(request.user, 'branch_set') else [])


@admin.register(Minister)
class MinisterAdmin(admin.ModelAdmin):
    list_display = ('name', 'branch', 'created_at')
    search_fields = ('name', 'branch__name')
    list_filter = ('branch',)

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        if request.user.is_superuser:
            return qs
        return qs.filter(branch_id__in=request.user.branch_set.values_list('id', flat=True) if hasattr(request.user, 'branch_set') else [])
