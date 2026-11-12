"""Telling people about workspace events (AGENT_EXECUTION_PLAN.md, Task 8.2).

`notify` is the one place notifications are made, so the mobile app (Task 8.7) can
send the same events to phones later by adding to it."""
import re

from django.utils import timezone
from rest_framework import mixins, serializers, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import Notification
from .structure_views import IsWorkspaceMember

DASHBOARD_LINK = re.compile(r"^/dashboard/[A-Za-z0-9/_\-?=&#.]*$")
SHOWN = 30


def notify(people, kind, text, link="", *, actor=None):
    """One notification each for `people` (duplicates and `actor` left out)."""
    link = link if DASHBOARD_LINK.fullmatch(link or "") and "//" not in link else ""
    seen, rows = set(), []
    for person in people:
        if person is None or person.pk in seen or (actor is not None and person.pk == actor.pk) or not person.is_active:
            continue
        seen.add(person.pk)
        rows.append(Notification(person=person, kind=kind, text=text[:300], link=link))
    Notification.objects.bulk_create(rows)
    return rows


class NotificationSerializer(serializers.ModelSerializer):
    read = serializers.SerializerMethodField()

    class Meta:
        model = Notification
        fields = ["id", "kind", "text", "link", "created_at", "read"]

    def get_read(self, obj):
        return obj.read_at is not None


class NotificationViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    """The signed-in person's notifications, newest first, with how many are unread."""
    permission_classes = [IsWorkspaceMember]
    serializer_class = NotificationSerializer
    pagination_class = None

    def get_queryset(self):
        return Notification.objects.filter(person=self.request.user)

    def list(self, request, *args, **kwargs):
        rows = self.get_queryset()
        return Response({
            "unread": rows.filter(read_at__isnull=True).count(),
            "results": self.get_serializer(rows[:SHOWN], many=True).data,
        })

    @action(detail=True, methods=["post"])
    def read(self, request, *args, **kwargs):
        row = self.get_object()
        if row.read_at is None:
            row.read_at = timezone.now()
            row.save(update_fields=["read_at"])
        return Response(self.get_serializer(row).data)

    @action(detail=False, methods=["post"], url_path="read-all")
    def read_all(self, request, *args, **kwargs):
        self.get_queryset().filter(read_at__isnull=True).update(read_at=timezone.now())
        return Response({"unread": 0})
