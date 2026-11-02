from django.contrib import admin

from .models import MediaTag, MediaAsset


class MediaAssetInline(admin.TabularInline):
    model = MediaAsset.tags.through
    extra = 1


@admin.register(MediaTag)
class MediaTagAdmin(admin.ModelAdmin):
    list_display = ('name',)
    search_fields = ('name',)


@admin.register(MediaAsset)
class MediaAssetAdmin(admin.ModelAdmin):
    list_display = ('title', 'file_type', 'branch', 'uploaded_by', 'uploaded_at')
    search_fields = ('title', 'description')
    list_filter = ('file_type', 'branch')

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        if request.user.is_superuser:
            return qs
        return qs.filter(branch_id__in=request.user.branch_set.values_list('id', flat=True) if hasattr(request.user, 'branch_set') else [])
