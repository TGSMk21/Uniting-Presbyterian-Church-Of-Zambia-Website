from rest_framework.exceptions import PermissionDenied
from rest_framework_simplejwt.authentication import JWTAuthentication

# What someone with a temporary password can still do.
ALLOWED_BEFORE_PASSWORD_CHANGE = {"auth-me", "auth-password-change"}


def is_active_staff(user):
    """Who may sign in to the dashboard or keep a session going."""
    return user is not None and user.is_active and user.is_staff


class StaffJWTAuthentication(JWTAuthentication):
    def authenticate(self, request):
        result = super().authenticate(request)
        if result and result[0].must_change_password:
            if request._request.resolver_match.url_name not in ALLOWED_BEFORE_PASSWORD_CHANGE:
                raise PermissionDenied(
                    "Choose a new password before continuing.",
                    code="password_change_required",
                )
        return result
