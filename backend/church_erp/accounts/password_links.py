"""Single-use links for choosing a password (AGENT_EXECUTION_PLAN.md, Task 7.2).

The secret in a link is 32 random bytes; only its SHA-256 is stored. The website
puts it after a # in the address, so it never reaches a server's logs, and sends
it to the API in a POST body, never in an address."""
import hashlib
import secrets
from datetime import timedelta

from django.db import transaction
from django.utils import timezone

from church_erp.core.changes import record

from . import two_factor
from .models import PasswordLink

LIFETIME = timedelta(hours=72)


def _hash(token):
    return hashlib.sha256(token.encode()).hexdigest()


def make_link(user, made_by):
    """A new link's secret, shown once. The person's unused links stop working."""
    token = secrets.token_urlsafe(32)
    with transaction.atomic():
        PasswordLink.objects.filter(user=user, used_at__isnull=True).delete()
        PasswordLink.objects.create(
            user=user, token_hash=_hash(token), made_by=made_by, expires_at=timezone.now() + LIFETIME,
        )
    record(made_by, "people", "set-password link made", branch=user.branch, target=user.username, target_id=user.pk)
    return token


def usable_link(token):
    """The link for `token` if it can still be used, otherwise None."""
    if not isinstance(token, str) or not token:
        return None
    return (
        PasswordLink.objects.select_related("user")
        .filter(token_hash=_hash(token), used_at__isnull=True, expires_at__gt=timezone.now(), user__is_active=True)
        .first()
    )


def use_link(link, password):
    """Set the password (already checked) and spend the link."""
    user = link.user
    with transaction.atomic():
        claimed = PasswordLink.objects.filter(pk=link.pk, used_at__isnull=True).update(used_at=timezone.now())
        if not claimed:
            return False  # used a moment ago, by another request
        user.set_password(password)
        user.must_change_password = False
        user.save(update_fields=["password", "must_change_password"])
        two_factor.end_sessions(user)
    record(user, "people", "password set", branch=user.branch, target=user.username, target_id=user.pk)
    return True
