import hmac

from django.conf import settings
from django.http import Http404, HttpResponseForbidden, JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST

from church_erp.content.tasks import sync_youtube_sermons


@csrf_exempt
@require_POST
def sync_youtube(request):
    """Run the YouTube sync on request, for hosts without scheduled jobs
    (Render's free plan). An external scheduler POSTs here with the
    X-Sync-Token header; calling it every 10 minutes also keeps a free
    Render service from sleeping. Disabled unless SYNC_TOKEN is set."""
    if not settings.SYNC_TOKEN:
        raise Http404
    token = request.headers.get("X-Sync-Token", "")
    if not hmac.compare_digest(token.encode(), settings.SYNC_TOKEN.encode()):
        return HttpResponseForbidden()
    return JsonResponse(sync_youtube_sermons())
