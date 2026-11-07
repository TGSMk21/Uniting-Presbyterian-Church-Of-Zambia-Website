from rest_framework import permissions, viewsets
from rest_framework.exceptions import NotFound
from church_erp.core.api_mixins import BranchScopedViewSetMixin
from church_erp.content.models import Sermon, Project, Activity
from church_erp.content.serializers import (
    SermonSerializer,
    ProjectSerializer,
    ActivitySerializer,
)


# Sermons, projects and activities are read-only here. Staff change them through
# the dashboard's own addresses in staff_content.py.
class SermonViewSet(BranchScopedViewSetMixin, viewsets.ReadOnlyModelViewSet):
    queryset = Sermon.objects.filter(is_hidden=False)
    serializer_class = SermonSerializer
    permission_classes = [permissions.AllowAny]
    lookup_field = 'video_id'

    def get_object(self):
        # video_id is only unique per branch, so a lookup without ?branch=
        # can match several sermons; treat that as not found rather than 500.
        matches = list(
            self.filter_queryset(self.get_queryset())
            .filter(video_id=self.kwargs['video_id'])[:2]
        )
        if len(matches) != 1:
            raise NotFound("No unique sermon with this video ID; pass ?branch=<slug>.")
        self.check_object_permissions(self.request, matches[0])
        return matches[0]


class ProjectViewSet(BranchScopedViewSetMixin, viewsets.ReadOnlyModelViewSet):
    queryset = Project.objects.all()
    serializer_class = ProjectSerializer
    permission_classes = [permissions.AllowAny]


class ActivityViewSet(BranchScopedViewSetMixin, viewsets.ReadOnlyModelViewSet):
    queryset = Activity.objects.select_related('branch').filter(branch__is_active=True)
    serializer_class = ActivitySerializer
    permission_classes = [permissions.AllowAny]
    filterset_fields = {'date': ['gte', 'lte']}  # e.g. ?date__gte=2026-11-02 for upcoming

