from django import forms
from django.contrib import admin, messages
from django.contrib.admin.helpers import ActionForm
from django.utils.html import format_html

from church_erp.core.admin_mixins import BranchScopedAdmin

from .models import MediaTag, MediaAsset


class MediaAssetInline(admin.TabularInline):
    model = MediaAsset.tags.through
    extra = 1


@admin.register(MediaTag)
class MediaTagAdmin(admin.ModelAdmin):
    list_display = ('name',)
    search_fields = ('name',)


class TagActionForm(ActionForm):
    tag = forms.CharField(required=False, max_length=100, label="Tag")


@admin.register(MediaAsset)
class MediaAssetAdmin(BranchScopedAdmin):
    list_display = ('preview', 'title', 'file_type', 'branch', 'uploaded_by', 'uploaded_at')
    list_display_links = ('preview', 'title')
    search_fields = ('title', 'description')
    list_filter = ('file_type', 'tags', 'branch')
    filter_horizontal = ('tags',)
    readonly_fields = ('uploaded_by',)
    action_form = TagActionForm
    actions = ['add_tag']

    @admin.display(description='')
    def preview(self, obj):
        if obj.file_type == 'image' and obj.file:
            return format_html('<img src="{}" alt="" style="height:48px;border-radius:4px">', obj.file.url)
        return ''

    @admin.action(description='Add tag to selected files')
    def add_tag(self, request, queryset):
        name = request.POST.get('tag', '').strip()
        if not name:
            self.message_user(request, 'Type a tag name next to the action first.', messages.WARNING)
            return
        tag, _ = MediaTag.objects.get_or_create(name=name)
        for asset in queryset:
            asset.tags.add(tag)
        self.message_user(request, f'Tagged {queryset.count()} file(s) "{tag.name}".')

    def save_model(self, request, obj, form, change):
        if not change:
            obj.uploaded_by = request.user
        super().save_model(request, obj, form, change)
