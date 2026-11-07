from django.contrib import admin, messages
from django.db import IntegrityError, transaction
from django.utils import timezone

from church_erp.core.admin_mixins import BranchScopedAdmin

from .models import DailyMessage, SermonDocument, SermonEmbedding


@admin.register(SermonDocument)
class SermonDocumentAdmin(BranchScopedAdmin):
    """Written sermons are private. Staff add them from the dashboard, which also reads files."""
    branch_lookup = 'minister__branch_id'
    branch_field = None
    list_display = ('title', 'minister', 'preached_on', 'created_at')
    search_fields = ('title', 'minister__name')
    fields = ('minister', 'title', 'preached_on', 'text', 'source_name', 'file_kind', 'uploaded_by')
    readonly_fields = ('source_name', 'file_kind', 'uploaded_by')

    def save_model(self, request, obj, form, change):
        if 'text' in form.changed_data and obj.pk:
            # New words are read again for the daily messages.
            obj.embeddings.all().delete()
        super().save_model(request, obj, form, change)


@admin.register(SermonEmbedding)
class SermonEmbeddingAdmin(BranchScopedAdmin):
    branch_lookup = 'document__minister__branch_id'
    branch_field = None
    list_display = ('document', 'chunk_index', 'model', 'created_at')
    search_fields = ('document__title',)
    exclude = ('embedding',)

    # Made by the daily message pipeline, never by hand.
    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False


@admin.register(DailyMessage)
class DailyMessageAdmin(BranchScopedAdmin):
    branch_lookup = 'minister__branch_id'
    branch_field = None
    list_display = ('title', 'minister', 'date', 'status', 'ai_generated', 'published_at')
    search_fields = ('title', 'minister__name')
    list_filter = ('status', 'ai_generated', 'date')
    readonly_fields = ('ai_generated', 'reviewed_by', 'published_at')
    actions = ('approve_and_publish', 'reject')

    @admin.action(description='Publish the chosen messages')
    def approve_and_publish(self, request, queryset):
        published, clashes = 0, 0
        for message in queryset.exclude(status='published'):
            try:
                with transaction.atomic():
                    DailyMessage.objects.filter(pk=message.pk).update(
                        status='published', reviewed_by=request.user, published_at=timezone.now(),
                    )
                published += 1
            except IntegrityError:
                # One published message per minister per day.
                clashes += 1
        if published:
            self.message_user(request, f'Published {published}.', messages.SUCCESS)
        if clashes:
            self.message_user(
                request, f'{clashes} not published: that minister already has a published message that day.',
                messages.WARNING,
            )

    @admin.action(description='Turn down the chosen messages')
    def reject(self, request, queryset):
        count = queryset.update(status='rejected', reviewed_by=None, published_at=None)
        self.message_user(request, f'Turned down {count}.', messages.SUCCESS)
