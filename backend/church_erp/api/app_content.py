"""Lean public addresses for the mobile app's sermon archive and daily-message library
(MOBILE_APP_PLAN.md, Phase 3). Same rules as /api/app/home/: public, read-only, one
active branch per request, never hidden sermons, never unpublished messages."""
from django.db import models
from django.db.models import Q
from django.utils import timezone
from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from church_erp.ai_messages.models import DailyMessage
from church_erp.content.models import Activity, Announcement, Hymn, Sermon
from church_erp.core.models import Branch

SERMONS_DEFAULT_LIMIT = 20
SERMONS_MAX_LIMIT = 50
MESSAGES_DEFAULT_LIMIT = 100
MESSAGES_MAX_LIMIT = 200
EVENTS_DEFAULT_LIMIT = 100
EVENTS_MAX_LIMIT = 200


def app_branch(request):
    """The one active branch this request is about, or a ready-to-return error response."""
    slug = request.query_params.get("branch", "").strip()
    if not slug:
        return None, Response({"error": "A branch is required: ?branch=<slug>"}, status=400)
    branch = Branch.objects.filter(slug=slug, is_active=True).first()
    if branch is None:
        return None, Response({"error": "No such branch"}, status=404)
    return branch, None


def clamp_limit(request, default, cap):
    try:
        return max(1, min(int(request.query_params.get("limit", default)), cap))
    except (TypeError, ValueError):
        return default


def sermon_row(sermon):
    return {
        "id": sermon.pk,
        "video_id": sermon.video_id,
        "title": sermon.title,
        "reference_verse": sermon.reference_verse,
        "preached_at": sermon.preached_at,
        "duration": sermon.duration,
        "is_live": sermon.is_live,
        "minister_name": sermon.minister.name if sermon.minister_id else "",
    }


class AppCacheMixin:
    """Short public caching for the app's reads: phones and proxies may reuse an answer for a minute."""
    cache_seconds = 60

    def finalize_response(self, request, response, *args, **kwargs):
        response = super().finalize_response(request, response, *args, **kwargs)
        if request.method == "GET" and response.status_code == 200:
            response["Cache-Control"] = f"public, max-age={self.cache_seconds}"
        return response


class AppSermonsView(AppCacheMixin, APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        branch, error = app_branch(request)
        if error:
            return error
        limit = clamp_limit(request, SERMONS_DEFAULT_LIMIT, SERMONS_MAX_LIMIT)
        sermons = (
            Sermon.objects.filter(branch=branch, is_hidden=False)
            .select_related("minister")
            .order_by("-preached_at", "-pk")[:limit]
        )
        return Response({
            "branch": {"slug": branch.slug, "name": branch.name},
            "sermons": [sermon_row(s) for s in sermons],
        })


def event_row(activity):
    return {
        "id": activity.pk,
        "title": activity.title,
        "date": activity.date,
        "start_time": activity.start_time,
        "end_time": activity.end_time,
        "location": activity.location,
        "details": activity.details,
        "photos": [{"id": p.pk, "url": p.image.url} for p in activity.photos.all()],
    }


class AppEventsView(AppCacheMixin, APIView):
    """Upcoming and past events, most recent first, with photos (Phase 4)."""
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        branch, error = app_branch(request)
        if error:
            return error
        limit = clamp_limit(request, EVENTS_DEFAULT_LIMIT, EVENTS_MAX_LIMIT)
        events = (
            Activity.objects.filter(branch=branch)
            .prefetch_related("photos")
            .order_by("-date", "-start_time", "-pk")[:limit]
        )
        return Response({
            "branch": {"slug": branch.slug, "name": branch.name},
            "events": [event_row(e) for e in events],
        })


class AppAnnouncementsView(AppCacheMixin, APIView):
    """Current announcements, pinned first (Phase 5). Same rules as the website's public list."""
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        branch, error = app_branch(request)
        if error:
            return error
        today = timezone.localdate()
        announcements = (
            Announcement.objects.filter(
                branch=branch, starts_on__lte=today,
            )
            .filter(Q(ends_on__isnull=True) | Q(ends_on__gte=today))
            .order_by("-is_pinned", "-starts_on", "-created_at")
        )
        return Response({
            "branch": {"slug": branch.slug, "name": branch.name},
            "announcements": [
                {
                    "id": a.pk,
                    "title": a.title,
                    "body": a.body,
                    "starts_on": a.starts_on,
                    "is_pinned": a.is_pinned,
                }
                for a in announcements
            ],
        })


class AppHymnCollectionsView(AppCacheMixin, APIView):
    """The three hymn collections with their counts (Phase 6). Church-wide, so no branch."""
    permission_classes = [permissions.AllowAny]
    cache_seconds = 3600

    def get(self, request):
        counts = dict(Hymn.objects.values_list("collection").annotate(total=models.Count("id")).order_by())
        return Response({
            "collections": [
                {"collection": key, "label": label, "count": counts.get(key, 0)}
                for key, label in Hymn.COLLECTIONS
            ],
        })


class AppHymnsView(AppCacheMixin, APIView):
    """Every hymn of one collection, by number, full text for offline download (Phase 6)."""
    permission_classes = [permissions.AllowAny]
    cache_seconds = 3600

    def get(self, request):
        collection = request.query_params.get("collection", "").strip()
        valid = {key for key, _label in Hymn.COLLECTIONS}
        if collection not in valid:
            return Response({"error": "A collection is required: ?collection=tumbuka|chewa|english"}, status=400)
        hymns = Hymn.objects.filter(collection=collection).order_by("number", "pk")
        return Response({
            "collection": collection,
            "hymns": [
                {
                    "id": h.pk, "collection": h.collection, "number": h.number, "title": h.title,
                    "verses": h.verses, "chorus": h.chorus, "notes": h.notes,
                }
                for h in hymns
            ],
        })


class AppMessagesView(AppCacheMixin, APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        branch, error = app_branch(request)
        if error:
            return error
        limit = clamp_limit(request, MESSAGES_DEFAULT_LIMIT, MESSAGES_MAX_LIMIT)
        today = timezone.localdate()
        query = (
            DailyMessage.objects.filter(minister__branch=branch, status="published", date__lte=today)
            .select_related("minister")
            .order_by("-date", "-published_at", "-pk")
        )
        q = request.query_params.get("q", "").strip()
        if q:
            query = query.filter(Q(title__icontains=q) | Q(reference_verse__icontains=q))
        return Response({
            "branch": {"slug": branch.slug, "name": branch.name},
            "messages": [
                {
                    "id": m.pk,
                    "title": m.title,
                    "reference_verse": m.reference_verse,
                    "date": m.date,
                }
                for m in query[:limit]
            ],
        })


class AppMessageDetailView(AppCacheMixin, APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, pk):
        branch, error = app_branch(request)
        if error:
            return error
        message = (
            DailyMessage.objects.filter(
                pk=pk, minister__branch=branch, status="published", date__lte=timezone.localdate(),
            )
            .select_related("minister")
            .first()
        )
        if message is None:
            return Response({"error": "No such message"}, status=404)
        return Response({
            "id": message.pk,
            "title": message.title,
            "message": message.message,
            "reference_verse": message.reference_verse,
            "verse_text": message.verse_text,
            "date": message.date,
            "minister_name": message.minister.name,
        })


class AppFavouritesCheckView(AppCacheMixin, APIView):
    """Do these ids still exist? GET /api/app/favourites/check/?branch=<slug>&sermons=4,9&messages=12

    The app asks this so a favourite whose content was removed is flagged instead of
    wrongly kept. Ids only — never any content. Junk is ignored, at most 200 per list."""
    permission_classes = [permissions.AllowAny]

    MAX_IDS = 200

    def get(self, request):
        branch, error = app_branch(request)
        if error:
            return error
        today = timezone.localdate()
        sermon_ids = self._ids(request, "sermons")
        message_ids = self._ids(request, "messages")
        sermons = sorted(
            Sermon.objects.filter(branch=branch, is_hidden=False, pk__in=sermon_ids)
            .values_list("pk", flat=True)
        )
        messages = sorted(
            DailyMessage.objects.filter(
                minister__branch=branch, status="published", date__lte=today, pk__in=message_ids,
            ).values_list("pk", flat=True)
        )
        return Response({
            "branch": {"slug": branch.slug, "name": branch.name},
            "sermons": sermons,
            "messages": messages,
        })

    def _ids(self, request, name):
        ids = []
        for part in request.query_params.get(name, "").split(","):
            part = part.strip()
            if part.isascii() and part.isdigit() and int(part) > 0:
                ids.append(int(part))
        return ids[: self.MAX_IDS]
