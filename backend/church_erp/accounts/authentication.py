from rest_framework.exceptions import PermissionDenied
from rest_framework_simplejwt.authentication import JWTAuthentication

from .two_factor import must_set_up_two_factor

# What someone can still do before finishing their account's first-time steps.
ALLOWED_DURING_SET_UP = {
    "auth-me", "auth-password-change", "auth-two-factor-setup", "auth-two-factor-confirm",
}


def is_active_staff(user):
    """Who may sign in to the dashboard or keep a session going."""
    return user is not None and user.is_active and user.is_staff


class StaffJWTAuthentication(JWTAuthentication):
    def authenticate(self, request):
        result = super().authenticate(request)
        if not result or request._request.resolver_match.url_name in ALLOWED_DURING_SET_UP:
            return result
        if result[0].must_change_password:
            raise PermissionDenied(
                "Choose a new password before continuing.",
                code="password_change_required",
            )
        if must_set_up_two_factor(result[0]):
            raise PermissionDenied(
                "Set up two-step login before continuing.",
                code="two_factor_setup_required",
            )
        return result
