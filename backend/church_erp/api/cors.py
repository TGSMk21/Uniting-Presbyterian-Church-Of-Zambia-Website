"""CORS for the Android app (MOBILE_APP_PLAN.md; review finding F01).

The app's WebView origin is allowed only for public reads the app makes. Staff
addresses stay limited to the website's origin (CORS_ALLOWED_ORIGINS)."""
import re

from django.conf import settings

APP_PATHS = re.compile(r"^/api/(app|branches)/")
SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}


def allow_app_origin(sender, request, **kwargs):
    origin = request.headers.get("Origin", "")
    return (
        origin in settings.APP_CORS_ORIGINS
        and request.method in SAFE_METHODS
        and bool(APP_PATHS.match(request.path_info))
    )
