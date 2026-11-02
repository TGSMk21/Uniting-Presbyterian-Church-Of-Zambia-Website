from django.contrib import admin

from church_erp.core.admin_mixins import BranchScopedAdmin

from .models import MediaTag, MediaAsset


class MediaAssetInline(admin.TabularInline):
    model = MediaAsset.tags.through
    extra = 1


@admin.register(MediaTag)
class MediaTagAdmin(admin.ModelAdmin):
    list_display = ('name',)
    search_fields = ('name',)


@admin.register(MediaAsset)
class MediaAssetAdmin(BranchScopedAdmin):
    list_display = ('title', 'file_type', 'branch', 'uploaded_by', 'uploaded_at')
    search_fields = ('title', 'description')
    list_filter = ('file_type', 'branch')
    readonly_fields = ('uploaded_by',)

    def save_model(self, request, obj, form, change):
        if not change:
            obj.uploaded_by = request.user
        super().save_model(request, obj, form, change)
