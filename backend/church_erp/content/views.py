from rest_framework import viewsets, permissions
from church_erp.content.models import Sermon, Project, Activity, Page
from church_erp.content.serializers import (
    SermonSerializer,
    ProjectSerializer,
    ActivitySerializer,
    PageSerializer,
)


class IsStaffOrReadOnly(permissions.BasePermission):
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        return request.user and request.user.is_staff


class SermonViewSet(viewsets.ModelViewSet):
    queryset = Sermon.objects.all()
    serializer_class = SermonSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly, IsStaffOrReadOnly]
    lookup_field = 'video_id'

    def get_queryset(self):
        qs = Sermon.objects.all()
        branch_slug = self.request.query_params.get('branch')
        if branch_slug:
            qs = qs.filter(branch__slug=branch_slug)
        return qs


class ProjectViewSet(viewsets.ModelViewSet):
    queryset = Project.objects.all()
    serializer_class = ProjectSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly, IsStaffOrReadOnly]

    def get_queryset(self):
        qs = Project.objects.all()
        branch_slug = self.request.query_params.get('branch')
        if branch_slug:
            qs = qs.filter(branch__slug=branch_slug)
        return qs


class ActivityViewSet(viewsets.ModelViewSet):
    queryset = Activity.objects.all()
    serializer_class = ActivitySerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly, IsStaffOrReadOnly]

    def get_queryset(self):
        qs = Activity.objects.all()
        branch_slug = self.request.query_params.get('branch')
        if branch_slug:
            qs = qs.filter(branch__slug=branch_slug)
        return qs


class PageViewSet(viewsets.ModelViewSet):
    queryset = Page.objects.all()
    serializer_class = PageSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly, IsStaffOrReadOnly]

    def get_queryset(self):
        if self.request.user.is_staff:
            qs = Page.objects.all()
        else:
            qs = Page.objects.filter(is_published=True)
        branch_slug = self.request.query_params.get('branch')
        if branch_slug:
            qs = qs.filter(branch__slug=branch_slug)
        return qs
