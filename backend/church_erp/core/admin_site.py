from django.core.exceptions import ValidationError
from django_otp.admin import OTPAdminAuthenticationForm, OTPAdminSite

from church_erp.accounts.two_factor import clean_code, device_for_code, has_two_factor, requires_two_factor


class StaffAdminLoginForm(OTPAdminAuthenticationForm):
    def clean_otp(self, user):
        if user is not None and not has_two_factor(user):
            if requires_two_factor(user):
                raise ValidationError(
                    "Your role needs two-step login. Sign in on the staff dashboard at "
                    "/dashboard to set it up, then come back here.",
                    code="two_factor_setup_required",
                )
            return
        super().clean_otp(user)

    def _verify_token(self, user, token, device=None):
        # People type one code; which device it's for comes from its format.
        token = clean_code(token)
        device = device_for_code(user, token)
        if device is None:
            raise ValidationError(self.otp_error_messages["invalid_token"], code="invalid_token")
        return super()._verify_token(user, token, device)


class StaffAdminSite(OTPAdminSite):
    """The Django admin, with the same two-step rules as the dashboard."""

    login_form = StaffAdminLoginForm
    login_template = "admin/staff_login.html"

    def __init__(self, name="admin"):
        super().__init__(name)

    def has_permission(self, request):
        user = request.user
        if not (user.is_active and user.is_staff):
            return False
        if user.is_verified():
            return True
        return not requires_two_factor(user) and not has_two_factor(user)
