from django.contrib import admin

from church_erp.core.admin_mixins import BranchScopedAdmin

from .models import Sermon, Project, Activity


@admin.register(Sermon)
class SermonAdmin(BranchScopedAdmin):
    list_display = ('title', 'branch', 'minister', 'preached_at', 'is_live', 'is_hidden')
    list_filter = ('is_live', 'is_hidden', 'branch')
    search_fields = ('title', 'description', 'reference_verse')
    date_hierarchy = 'preached_at'


@admin.register(Project)
class ProjectAdmin(BranchScopedAdmin):
    list_display = ('title', 'branch', 'status', 'progress', 'start_date', 'end_date')
    list_filter = ('status', 'branch')
    search_fields = ('title', 'description')


@admin.register(Activity)
class ActivityAdmin(BranchScopedAdmin):
    list_display = ('title', 'branch', 'date', 'start_time', 'end_time', 'location')
    list_filter = ('branch', 'date')
    search_fields = ('title', 'details', 'location')

