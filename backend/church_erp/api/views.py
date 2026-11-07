import hmac

from django.conf import settings
from django.http import Http404, HttpResponseForbidden, JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST

from church_erp.ai_messages.generation import run_daily
from church_erp.content.tasks import sync_youtube_sermons

# The website host stops a request after 60 seconds; stop well before.
DAILY_MESSAGES_SECONDS = 25


def _token_ok(request):
    """For hosts without scheduled jobs (Render's free plan): an outside scheduler
    POSTs with the X-Sync-Token header. Off unless SYNC_TOKEN is set."""
    if not settings.SYNC_TOKEN:
        raise Http404
    token = request.headers.get("X-Sync-Token", "")
    return hmac.compare_digest(token.encode(), settings.SYNC_TOKEN.encode())


@csrf_exempt
@require_POST
def sync_youtube(request):
    """Run the YouTube sync on request. Calling it every 10 minutes also keeps a
    free Render service from sleeping."""
    if not _token_ok(request):
        return HttpResponseForbidden()
    return JsonResponse(sync_youtube_sermons())


@csrf_exempt
@require_POST
def generate_daily_messages(request):
    """Read waiting sermons and write tomorrow's daily message drafts (Task 4.4).
    Each call works for at most 25 seconds; call it hourly and the next call
    carries on. Drafts are never published by this."""
    if not _token_ok(request):
        return HttpResponseForbidden()
    return JsonResponse(run_daily(budget_seconds=DAILY_MESSAGES_SECONDS))
