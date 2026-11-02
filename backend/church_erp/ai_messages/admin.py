from django.contrib import admin

from .models import SermonEmbedding, DailyMessage


class SermonEmbeddingInline(admin.TabularInline):
    model = SermonEmbedding
    extra = 0
    readonly_fields = ('chunk_index', 'chunk_text', 'embedding', 'created_at')
    can_delete = False


@admin.register(SermonEmbedding)
class SermonEmbeddingAdmin(admin.ModelAdmin):
    list_display = ('sermon', 'chunk_index', 'created_at')
    search_fields = ('sermon__title',)

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        if request.user.is_superuser:
            return qs
        return qs.filter(sermon__branch_id__in=request.user.branch_set.values_list('id', flat=True) if hasattr(request.user, 'branch_set') else [])


@admin.register(DailyMessage)
class DailyMessageAdmin(admin.ModelAdmin):
    list_display = ('title', 'minister', 'date', 'status', 'published_at')
    search_fields = ('title', 'minister__name')
    list_filter = ('status', 'date')

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        if request.user.is_superuser:
            return qs
        return qs.filter(minister__branch_id__in=request.user.branch_set.values_list('id', flat=True) if hasattr(request.user, 'branch_set') else [])
