"""Staff sign-in for the dashboard (AGENT_EXECUTION_PLAN.md, Task 5.1)."""
from datetime import timedelta
from unittest.mock import patch

from axes.models import AccessAttempt
from django.conf import settings
from django.core.cache import cache
from django.core.management import call_command
from django.test import override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase
from rest_framework_simplejwt.settings import api_settings
from rest_framework_simplejwt.token_blacklist.models import OutstandingToken

from church_erp.accounts.auth_views import LoginThrottle
from church_erp.accounts.models import User
from church_erp.core.tests.helpers import make_branch

SECRET = "test-internal-secret-0123456789"
PASSWORD = "correct-horse-battery"
NEW_PASSWORD = "a-much-better-passphrase-77"


@override_settings(INTERNAL_API_SECRET=SECRET)
class AuthTestCase(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.branch = make_branch("alpha")
        cls.staff = User.objects.create_user(
            "manager", password=PASSWORD, is_staff=True, branch=cls.branch,
            role="branch_admin", first_name="Mary", last_name="Banda",
        )
        cls.other = User.objects.create_user(
            "editor", password=PASSWORD, is_staff=True, branch=cls.branch, role="content_editor",
        )

    def setUp(self):
        cache.clear()
        self.addCleanup(cache.clear)

    def server_post(self, name, data=None, address="198.51.100.1"):
        """A request as the website's server sends it."""
        return self.client.post(
            reverse(name), data or {}, format="json",
            HTTP_X_INTERNAL_SECRET=SECRET, HTTP_X_CLIENT_ADDRESS=address,
        )

    def login(self, username="manager", password=PASSWORD, address="198.51.100.1"):
        return self.server_post("auth-login", {"username": username, "password": password}, address)

    def tokens(self, username="manager"):
        response = self.login(username)
        self.assertEqual(response.status_code, 200, response.content)
        return response.data

    def bearer(self, access):
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")


class WebsiteServerOnlyTests(AuthTestCase):
    ROUTES = ("auth-login", "auth-refresh", "auth-logout")

    def test_routes_are_hidden_without_the_secret(self):
        for name in self.ROUTES:
            with self.subTest(name=name):
                response = self.client.post(reverse(name), {"username": "manager", "password": PASSWORD}, format="json")
                self.assertEqual(response.status_code, 404)

    def test_routes_are_hidden_with_the_wrong_secret(self):
        for name in self.ROUTES:
            with self.subTest(name=name):
                response = self.client.post(
                    reverse(name), {"username": "manager", "password": PASSWORD},
                    format="json", HTTP_X_INTERNAL_SECRET="wrong",
                )
                self.assertEqual(response.status_code, 404)

    @override_settings(INTERNAL_API_SECRET="")
    def test_routes_are_off_until_the_secret_is_set(self):
        for header in ("", "anything"):
            with self.subTest(header=header):
                response = self.client.post(
                    reverse("auth-login"), {"username": "manager", "password": PASSWORD},
                    format="json", HTTP_X_INTERNAL_SECRET=header,
                )
                self.assertEqual(response.status_code, 404)

    def test_guesses_without_the_secret_do_not_count_towards_a_lockout(self):
        for _ in range(settings.AXES_FAILURE_LIMIT + 1):
            self.client.post(reverse("auth-login"), {"username": "manager", "password": "x"}, format="json")
        self.assertEqual(self.login().status_code, 200)


class LoginTests(AuthTestCase):
    def test_staff_get_tokens(self):
        data = self.tokens()
        self.assertIn("access", data)
        self.assertIn("refresh", data)

    def test_every_refusal_looks_the_same(self):
        User.objects.create_user("member", password=PASSWORD)
        User.objects.create_user("gone", password=PASSWORD, is_staff=True, is_active=False)
        wrong = self.login(password="wrong", address="203.0.113.1")
        self.assertEqual(wrong.status_code, 401)
        for username, password, address in (
            ("nobody", PASSWORD, "203.0.113.2"),
            ("member", PASSWORD, "203.0.113.3"),
            ("gone", PASSWORD, "203.0.113.4"),
        ):
            with self.subTest(username=username):
                response = self.login(username, password, address)
                self.assertEqual(response.status_code, 401)
                self.assertEqual(response.data, wrong.data)

    def test_token_settings(self):
        self.assertLessEqual(api_settings.ACCESS_TOKEN_LIFETIME, timedelta(minutes=15))
        self.assertLessEqual(api_settings.REFRESH_TOKEN_LIFETIME, timedelta(days=7))
        self.assertTrue(api_settings.ROTATE_REFRESH_TOKENS)
        self.assertTrue(api_settings.BLACKLIST_AFTER_ROTATION)


class LockoutTests(AuthTestCase):
    def fail(self, times, username="manager", address="198.51.100.1"):
        for _ in range(times):
            self.login(username, "wrong", address)

    def test_too_many_failures_lock_the_account_even_for_the_right_password(self):
        self.fail(settings.AXES_FAILURE_LIMIT)
        self.assertEqual(self.login().status_code, 429)

    def test_rotating_addresses_still_locks_the_account(self):
        for number in range(settings.AXES_FAILURE_LIMIT):
            self.login("manager", "wrong", f"198.51.100.{number + 1}")
        self.assertEqual(self.login(address="203.0.113.9").status_code, 429)

    def test_one_persons_failures_do_not_lock_out_other_staff(self):
        # All of these reach the API from the same server address, as they do from Vercel.
        self.fail(settings.AXES_FAILURE_LIMIT, address="198.51.100.1")
        self.assertEqual(self.login("editor", address="198.51.100.2").status_code, 200)

    def test_trying_many_usernames_locks_only_that_visitor(self):
        for number in range(settings.AXES_FAILURE_LIMIT):
            self.login(f"guess{number}", "wrong", "198.51.100.1")
        self.assertEqual(self.login("editor", address="198.51.100.1").status_code, 429)
        self.assertEqual(self.login("editor", address="198.51.100.2").status_code, 200)

    def test_failures_record_the_visitors_address(self):
        self.fail(1, address="198.51.100.7")
        self.assertEqual(AccessAttempt.objects.get().ip_address, "198.51.100.7")

    def test_the_lock_lifts_by_itself(self):
        self.fail(settings.AXES_FAILURE_LIMIT)
        AccessAttempt.objects.update(
            attempt_time=timezone.now() - settings.AXES_COOLOFF_TIME - timedelta(minutes=1)
        )
        self.assertEqual(self.login().status_code, 200)

    def test_success_clears_earlier_mistakes(self):
        self.fail(settings.AXES_FAILURE_LIMIT - 1)
        self.assertEqual(self.login().status_code, 200)
        self.fail(settings.AXES_FAILURE_LIMIT - 1)
        self.assertEqual(self.login().status_code, 200)

    def test_login_requests_are_rate_limited_per_visitor(self):
        with patch.object(LoginThrottle, "rate", "2/min", create=True):
            for _ in range(2):
                self.assertEqual(self.login(address="198.51.100.1").status_code, 200)
            self.assertEqual(self.login(address="198.51.100.1").status_code, 429)
            self.assertEqual(self.login(address="198.51.100.2").status_code, 200)


class ClientAddressTests(AuthTestCase):
    def test_an_invalid_address_header_is_ignored(self):
        self.login(password="wrong", address="not-an-address")
        self.assertEqual(AccessAttempt.objects.get().ip_address, "127.0.0.1")

    def test_public_visitors_cannot_choose_their_address(self):
        # Without the secret the header means nothing, so it can't be used to dodge a limit.
        from church_erp.api.throttling import PublicReadThrottle
        with patch.object(PublicReadThrottle, "rate", "1/min", create=True):
            first = self.client.get(reverse("branch-list"), HTTP_X_CLIENT_ADDRESS="198.51.100.1")
            second = self.client.get(reverse("branch-list"), HTTP_X_CLIENT_ADDRESS="198.51.100.2")
        self.assertEqual([first.status_code, second.status_code], [200, 429])

    def test_the_website_server_cannot_be_used_as_one_shared_visitor(self):
        from church_erp.api.throttling import PublicReadThrottle
        with patch.object(PublicReadThrottle, "rate", "1/min", create=True):
            codes = [
                self.client.get(
                    reverse("branch-list"), HTTP_X_INTERNAL_SECRET=SECRET, HTTP_X_CLIENT_ADDRESS=address,
                ).status_code
                for address in ("198.51.100.1", "198.51.100.2", "198.51.100.1")
            ]
        self.assertEqual(codes, [200, 200, 429])


class RefreshAndLogoutTests(AuthTestCase):
    def refresh(self, token):
        return self.server_post("auth-refresh", {"refresh": token})

    def test_refresh_gives_a_new_pair(self):
        old = self.tokens()
        response = self.refresh(old["refresh"])
        self.assertEqual(response.status_code, 200, response.content)
        self.assertIn("access", response.data)
        self.assertNotEqual(response.data["refresh"], old["refresh"])

    def test_a_refresh_token_only_works_once(self):
        old = self.tokens()
        self.assertEqual(self.refresh(old["refresh"]).status_code, 200)
        self.assertEqual(self.refresh(old["refresh"]).status_code, 401)

    def test_suspended_staff_cannot_refresh(self):
        tokens = self.tokens()
        User.objects.filter(pk=self.staff.pk).update(is_active=False)
        self.assertEqual(self.refresh(tokens["refresh"]).status_code, 401)

    def test_staff_who_lost_staff_status_cannot_refresh(self):
        tokens = self.tokens()
        User.objects.filter(pk=self.staff.pk).update(is_staff=False)
        self.assertEqual(self.refresh(tokens["refresh"]).status_code, 401)

    def test_sign_out_ends_the_session(self):
        tokens = self.tokens()
        response = self.server_post("auth-logout", {"refresh": tokens["refresh"]})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.refresh(tokens["refresh"]).status_code, 401)


class ExpiredTokenCleanupTests(AuthTestCase):
    def test_the_startup_cleanup_removes_only_expired_tokens(self):
        # render.yaml runs this on every start, so a failure would stop the backend starting.
        self.tokens()
        self.tokens("editor")
        self.assertEqual(OutstandingToken.objects.count(), 2)
        expired = OutstandingToken.objects.get(user=self.other)
        OutstandingToken.objects.filter(pk=expired.pk).update(
            expires_at=timezone.now() - timedelta(days=1)
        )
        call_command("flushexpiredtokens", verbosity=0)
        self.assertEqual(list(OutstandingToken.objects.values_list("user__username", flat=True)), ["manager"])


class MeTests(AuthTestCase):
    def test_signed_out_is_refused(self):
        self.assertEqual(self.client.get(reverse("auth-me")).status_code, 401)

    def test_returns_who_is_signed_in_without_secrets(self):
        self.bearer(self.tokens()["access"])
        response = self.client.get(reverse("auth-me"))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["username"], "manager")
        self.assertEqual(response.data["name"], "Mary Banda")
        self.assertEqual(response.data["role"], "branch_admin")
        self.assertEqual(response.data["role_label"], "Branch Admin")
        self.assertEqual(response.data["branch"], {"slug": "alpha", "name": "Alpha"})
        self.assertIs(response.data["is_superuser"], False)
        self.assertIs(response.data["must_change_password"], False)
        self.assertNotIn("password", response.data)

    def test_a_valid_token_stops_working_when_staff_status_is_removed(self):
        self.bearer(self.tokens()["access"])
        User.objects.filter(pk=self.staff.pk).update(is_staff=False)
        self.assertEqual(self.client.get(reverse("auth-me")).status_code, 403)

    def test_a_valid_token_stops_working_when_suspended(self):
        self.bearer(self.tokens()["access"])
        User.objects.filter(pk=self.staff.pk).update(is_active=False)
        self.assertEqual(self.client.get(reverse("auth-me")).status_code, 401)


class PasswordChangeTests(AuthTestCase):
    def change(self, current=PASSWORD, new=NEW_PASSWORD):
        return self.client.post(
            reverse("auth-password-change"),
            {"current_password": current, "new_password": new}, format="json",
        )

    def test_signed_out_is_refused(self):
        self.assertEqual(self.change().status_code, 401)

    def test_wrong_current_password_changes_nothing(self):
        self.bearer(self.tokens()["access"])
        response = self.change(current="wrong")
        self.assertEqual(response.status_code, 400)
        self.assertIn("current_password", response.data)
        self.staff.refresh_from_db()
        self.assertTrue(self.staff.check_password(PASSWORD))

    def test_weak_passwords_are_refused(self):
        self.bearer(self.tokens()["access"])
        for weak in ("password", "12345678", "short"):
            with self.subTest(weak=weak):
                response = self.change(new=weak)
                self.assertEqual(response.status_code, 400)
                self.assertIn("new_password", response.data)

    def test_the_new_password_must_differ(self):
        self.bearer(self.tokens()["access"])
        response = self.change(new=PASSWORD)
        self.assertEqual(response.status_code, 400)
        self.assertIn("new_password", response.data)

    def test_changing_it_ends_old_sessions_and_gives_a_new_one(self):
        old = self.tokens()
        elsewhere = self.tokens()
        self.bearer(old["access"])
        response = self.change()
        self.assertEqual(response.status_code, 200, response.content)

        self.assertEqual(self.client.get(reverse("auth-me")).status_code, 401)
        self.client.credentials()
        for refresh in (old["refresh"], elsewhere["refresh"]):
            self.assertEqual(self.server_post("auth-refresh", {"refresh": refresh}).status_code, 401)

        self.bearer(response.data["access"])
        self.assertEqual(self.client.get(reverse("auth-me")).status_code, 200)
        self.client.credentials()
        self.assertEqual(self.server_post("auth-refresh", {"refresh": response.data["refresh"]}).status_code, 200)

    def test_only_the_new_password_signs_in_afterwards(self):
        self.bearer(self.tokens()["access"])
        self.change()
        self.client.credentials()
        self.assertEqual(self.login(password=PASSWORD).status_code, 401)
        self.assertEqual(self.login(password=NEW_PASSWORD).status_code, 200)


class ForcedPasswordChangeTests(AuthTestCase):
    def setUp(self):
        super().setUp()
        User.objects.filter(pk=self.staff.pk).update(must_change_password=True)

    def test_me_says_so(self):
        self.bearer(self.tokens()["access"])
        self.assertIs(self.client.get(reverse("auth-me")).data["must_change_password"], True)

    def test_nothing_else_works_until_it_is_changed(self):
        self.bearer(self.tokens()["access"])
        response = self.client.post(reverse("sermon-list"), {}, format="json")
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.data["detail"].code, "password_change_required")
        self.assertEqual(self.client.get(reverse("sermon-list")).status_code, 403)

    def test_changing_it_clears_the_requirement(self):
        self.bearer(self.tokens()["access"])
        response = self.client.post(
            reverse("auth-password-change"),
            {"current_password": PASSWORD, "new_password": NEW_PASSWORD}, format="json",
        )
        self.assertEqual(response.status_code, 200, response.content)
        self.staff.refresh_from_db()
        self.assertFalse(self.staff.must_change_password)
        self.bearer(response.data["access"])
        self.assertNotEqual(self.client.post(reverse("sermon-list"), {}, format="json").status_code, 403)
