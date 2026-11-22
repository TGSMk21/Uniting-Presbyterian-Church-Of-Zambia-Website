"""The mobile app's one lean home address: GET /api/app/home/?branch=<slug>.

Public and read-only. One request returns today's verse, the daily message, anything
live, the latest sermons and the upcoming events of one active branch (MOBILE_APP_PLAN.md, Phase 2)."""
from django.utils import timezone
from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from church_erp.ai_messages.models import DailyMessage
from church_erp.api.app_content import AppCacheMixin, sermon_row
from church_erp.content.models import Activity, PageContent, Sermon
from church_erp.core.models import Branch

SERMONS_LIMIT = 5
EVENTS_LIMIT = 5
RECENT_EVENTS_LIMIT = 3


def event_row(activity):
    return {
        "id": activity.pk,
        "title": activity.title,
        "date": activity.date,
        "start_time": activity.start_time,
        "end_time": activity.end_time,
        "location": activity.location,
    }


def home_verse(branch, message):
    if message and message.verse_text:
        return {"text": message.verse_text, "ref": message.reference_verse}
    fields = (
        PageContent.objects.filter(branch=branch, page="home")
        .values_list("fields", flat=True)
        .first()
        or {}
    )
    if fields.get("verse_text"):
        return {"text": fields["verse_text"], "ref": fields.get("verse_ref", "")}
    return None


class AppHomeView(AppCacheMixin, APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        slug = request.query_params.get("branch", "").strip()
        if not slug:
            return Response({"error": "A branch is required: ?branch=<slug>"}, status=400)
        branch = Branch.objects.filter(slug=slug, is_active=True).first()
        if branch is None:
            return Response({"error": "No such branch"}, status=404)

        today = timezone.localdate()
        message = (
            DailyMessage.objects.filter(
                minister__branch=branch, status="published", date__lte=today,
            )
            .order_by("-date", "-published_at", "-pk")
            .first()
        )
        live = (
            Sermon.objects.filter(branch=branch, is_live=True, is_hidden=False)
            .select_related("minister")
            .order_by("-preached_at")
            .first()
        )
        events = list(
            Activity.objects.filter(branch=branch, date__gte=today)
            .order_by("date", "start_time", "pk")[:EVENTS_LIMIT]
        )
        # When nothing is upcoming, the home screen shows the most recent past events instead.
        recent_events = (
            []
            if events
            else [
                event_row(a)
                for a in Activity.objects.filter(branch=branch, date__lt=today)
                .order_by("-date", "-start_time", "-pk")[:RECENT_EVENTS_LIMIT]
            ]
        )
        return Response({
            "branch": {"slug": branch.slug, "name": branch.name},
            "date": today,
            "verse": home_verse(branch, message),
            "daily_message": None if message is None else {
                "id": message.pk,
                "title": message.title,
                "message": message.message,
                "reference_verse": message.reference_verse,
                "date": message.date,
                "verse_text": message.verse_text,
            },
            "live": None if live is None else sermon_row(live),
            "sermons": [
                sermon_row(s)
                for s in Sermon.objects.filter(branch=branch, is_hidden=False)
                .select_related("minister")
                .order_by("-preached_at")[:SERMONS_LIMIT]
            ],
            "events": [event_row(a) for a in events],
            "recent_events": recent_events,
        })
