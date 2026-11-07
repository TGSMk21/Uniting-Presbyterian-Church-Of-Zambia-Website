from django.urls import path

from .access_requests import PasswordLinkCheckView, PasswordLinkUseView

from .auth_views import (
    LoginVerifyView, LoginView, LogoutView, MeView, PasswordChangeView, RefreshView,
    TwoFactorConfirmView, TwoFactorSetupView,
)

urlpatterns = [
    path('login/', LoginView.as_view(), name='auth-login'),
    path('login/verify/', LoginVerifyView.as_view(), name='auth-login-verify'),
    path('refresh/', RefreshView.as_view(), name='auth-refresh'),
    path('logout/', LogoutView.as_view(), name='auth-logout'),
    path('me/', MeView.as_view(), name='auth-me'),
    path('password/change/', PasswordChangeView.as_view(), name='auth-password-change'),
    path('two-factor/setup/', TwoFactorSetupView.as_view(), name='auth-two-factor-setup'),
    path('two-factor/confirm/', TwoFactorConfirmView.as_view(), name='auth-two-factor-confirm'),
    path('password-link/check/', PasswordLinkCheckView.as_view(), name='auth-password-link-check'),
    path('password-link/use/', PasswordLinkUseView.as_view(), name='auth-password-link-use'),
]
