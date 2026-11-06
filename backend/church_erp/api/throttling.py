"""API rate limits. Rates live in REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"].

Counts are kept in Django's default per-process cache, so with two gunicorn
workers the real limit can be up to twice the configured rate. That's enough
to stop abuse without paying for a shared Redis.
"""
from rest_framework.permissions import SAFE_METHODS
from rest_framework.throttling import AnonRateThrottle, SimpleRateThrottle, UserRateThrottle


class ClientAddressMixin:
    """Identify visitors by the address Cloudflare, in front of Render, saw.

    A client can put anything in X-Forwarded-For, so DRF's default would hand
    out a fresh allowance for each made-up value. Cloudflare overwrites
    CF-Connecting-IP on every request.
    """

    def get_ident(self, request):
        return request.META.get("HTTP_CF_CONNECTING_IP", "").strip() or super().get_ident(request)


class PublicReadThrottle(ClientAddressMixin, AnonRateThrottle):
    """Requests from people who aren't signed in."""


class StaffThrottle(ClientAddressMixin, UserRateThrottle):
    """Requests from signed-in staff. Anonymous requests are left to PublicReadThrottle."""

    def get_cache_key(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return None
        return super().get_cache_key(request, view)


class WriteThrottle(ClientAddressMixin, SimpleRateThrottle):
    """A stricter limit on anything that changes data, per user."""

    scope = "write"

    def get_cache_key(self, request, view):
        if request.method in SAFE_METHODS:
            return None
        if request.user and request.user.is_authenticated:
            ident = request.user.pk
        else:
            ident = self.get_ident(request)
        return self.cache_format % {"scope": self.scope, "ident": ident}
