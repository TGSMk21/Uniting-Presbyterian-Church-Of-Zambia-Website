from django.contrib import admin

from .models import Sermon, Project, Activity, Page


@admin.register(Sermon)
class SermonAdmin(admin.ModelAdmin):
    list_display = ('title', 'branch', 'minister', 'preached_at', 'is_live')
    list_filter = ('is_live', 'branch')
    search_fields = ('title', 'description', 'reference_verse')
    date_hierarchy = 'preached_at'

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        if request.user.is_superuser:
            return qs
        return qs.filter(branch_id__in=request.user.branch_set.values_list('id', flat=True) if hasattr(request.user, 'branch_set') else [])


@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display = ('title', 'branch', 'status', 'progress', 'start_date', 'end_date')
    list_filter = ('status', 'branch')
    search_fields = ('title', 'description')

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        if request.user.is_superuser:
            return qs
        return qs.filter(branch_id__in=request.user.branch_set.values_list('id', flat=True) if hasattr(request.user, 'branch_set') else [])


@admin.register(Activity)
class ActivityAdmin(admin.ModelAdmin):
    list_display = ('title', 'branch', 'date', 'start_time', 'end_time', 'location')
    list_filter = ('branch', 'date')
    search_fields = ('title', 'details', 'location')

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        if request.user.is_superuser:
            return qs
        return qs.filter(branch_id__in=request.user.branch_set.values_list('id', flat=True) if hasattr(request.user, 'branch_set') else [])


@admin.register(Page)
class PageAdmin(admin.ModelAdmin):
    list_display = ('title', 'branch', 'slug', 'is_published', 'updated_at')
    list_filter = ('is_published', 'branch')
    search_fields = ('title', 'slug', 'content')
    prepopulated_fields = {'slug': ('title',)}

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        if request.user.is_superuser:
            return qs
        return qs.filter(branch_id__in=request.user.branch_set.values_list('id', flat=True) if hasattr(request.user, 'branch_set') else [])
