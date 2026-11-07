"""Two-step login: an authenticator app, plus one-time recovery codes."""
import base64
from io import BytesIO

import qrcode
from django.conf import settings
from django.core import signing
from django.db import transaction
from django_otp.plugins.otp_static.models import StaticDevice, StaticToken
from django_otp.plugins.otp_totp.models import TOTPDevice
from qrcode.image.svg import SvgPathImage
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken

from .models import User

CHALLENGE_MAX_AGE = 5 * 60  # seconds
CHALLENGE_SALT = "church_erp.accounts.two_factor"
REQUIRED_ROLES = {"super_admin", "branch_admin", "finance_admin"}
RECOVERY_CODE_COUNT = 10


def requires_two_factor(user):
    return settings.REQUIRE_TWO_FACTOR and (user.is_superuser or user.role in REQUIRED_ROLES)


def has_two_factor(user):
    return TOTPDevice.objects.filter(user=user, confirmed=True).exists()


def must_set_up_two_factor(user):
    return requires_two_factor(user) and not has_two_factor(user)


def make_challenge(user):
    """Proof that this person got past the password step a moment ago."""
    return signing.dumps({"u": user.pk, "h": user.get_session_auth_hash()}, salt=CHALLENGE_SALT)


def read_challenge(challenge):
    """The active staff user a challenge belongs to, or None. A password change voids it."""
    try:
        data = signing.loads(str(challenge), salt=CHALLENGE_SALT, max_age=CHALLENGE_MAX_AGE)
        user = User.objects.get(pk=data["u"], is_active=True, is_staff=True)
    except (signing.BadSignature, User.DoesNotExist, KeyError, TypeError):
        return None
    return user if signing.constant_time_compare(data["h"], user.get_session_auth_hash()) else None


def clean_code(code):
    return "".join(str(code).split()).lower()


def device_for_code(user, code):
    """Which device a code is for: six digits are from the app, anything else is a
    recovery code. Trying both would count a miss against each and slow them both down."""
    cleaned = clean_code(code)
    model = TOTPDevice if cleaned.isdigit() and len(cleaned) == 6 else StaticDevice
    return model.objects.select_for_update().filter(user=user, confirmed=True).first()


def verify_code(user, code):
    """Check an app code or recovery code. Each works once; wrong guesses get slowed down."""
    code = clean_code(code)
    if not code:
        return False
    with transaction.atomic():
        device = device_for_code(user, code)
        return device is not None and device.verify_token(code)


def pending_device(user):
    """The device being set up. Reloading the page keeps the same key."""
    device = TOTPDevice.objects.filter(user=user, confirmed=False).first()
    return device or TOTPDevice.objects.create(user=user, name="Authenticator app", confirmed=False)


def setup_details(device):
    image = qrcode.make(device.config_url, image_factory=SvgPathImage, box_size=10, border=2)
    buffer = BytesIO()
    image.save(buffer)
    return {
        "key": base64.b32encode(device.bin_key).decode(),
        "otpauth_url": device.config_url,
        "qr_code": "data:image/svg+xml;base64," + base64.b64encode(buffer.getvalue()).decode(),
    }


def end_sessions(user):
    """Refresh tokens stop working now; access tokens run out within 15 minutes."""
    for token in OutstandingToken.objects.filter(user=user):
        BlacklistedToken.objects.get_or_create(token=token)


def confirm_device(user, device):
    """Turn two-step on. Returns the recovery codes, which are shown only once."""
    with transaction.atomic():
        device.confirmed = True
        device.save(update_fields=["confirmed"])
        StaticDevice.objects.filter(user=user).delete()
        recovery = StaticDevice.objects.create(user=user, name="Recovery codes", confirmed=True)
        codes = [StaticToken.random_token() for _ in range(RECOVERY_CODE_COUNT)]
        StaticToken.objects.bulk_create(StaticToken(device=recovery, token=code) for code in codes)
        end_sessions(user)
    return codes


def reset_two_factor(user):
    """For a lost phone: they set it up again at their next sign-in."""
    with transaction.atomic():
        TOTPDevice.objects.filter(user=user).delete()
        StaticDevice.objects.filter(user=user).delete()
        end_sessions(user)
