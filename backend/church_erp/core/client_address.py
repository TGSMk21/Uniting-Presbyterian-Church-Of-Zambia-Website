import hmac
import ipaddress

from django.conf import settings


def has_internal_secret(request):
    """Is this request from the website's own server? Off until the secret is set."""
    expected = settings.INTERNAL_API_SECRET
    if not expected:
        return False
    given = request.META.get("HTTP_X_INTERNAL_SECRET", "")
    return hmac.compare_digest(given.encode(), expected.encode())


def known_client_address(request):
    """The visitor's address if we can trust it, otherwise an empty string.

    Dashboard requests reach the API from the website's server, which passes the
    visitor's address along. Only that server's word is taken for it. Everything
    else uses the address Cloudflare, in front of Render, saw.
    """
    if has_internal_secret(request):
        forwarded = request.META.get("HTTP_X_CLIENT_ADDRESS", "").strip()
        try:
            ipaddress.ip_address(forwarded)
            return forwarded
        except ValueError:
            pass
    return request.META.get("HTTP_CF_CONNECTING_IP", "").strip()


def client_address(request):
    return known_client_address(request) or request.META.get("REMOTE_ADDR", "")
