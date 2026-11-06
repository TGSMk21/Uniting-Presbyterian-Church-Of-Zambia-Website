def client_address(request):
    """The visitor's address, as seen by Cloudflare in front of Render."""
    return (
        request.META.get("HTTP_CF_CONNECTING_IP", "").strip()
        or request.META.get("REMOTE_ADDR", "")
    )
