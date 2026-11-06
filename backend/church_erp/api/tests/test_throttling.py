"""API rate limits (AGENT_EXECUTION_PLAN.md, Phase 6)."""
from unittest.mock import patch

from django.conf import settings
from django.core.cache import cache
from django.urls import NoReverseMatch, reverse
from rest_framework.test import APITestCase

from church_erp.accounts.models import User
from church_erp.api.throttling import PublicReadThrottle, StaffThrottle, WriteThrottle
from church_erp.core.tests.helpers import make_branch


def limit(throttle, rate):
    return patch.object(throttle, "rate", rate, create=True)


class ThrottleTestCase(APITestCase):
    def setUp(self):
        cache.clear()
        self.addCleanup(cache.clear)


class PublicReadLimitTests(ThrottleTestCase):
    def test_reads_over_the_limit_get_429_with_retry_after(self):
        with limit(PublicReadThrottle, "2/min"):
            codes = [self.client.get(reverse("branch-list")).status_code for _ in range(2)]
            blocked = self.client.get(reverse("branch-list"))
        self.assertEqual(codes, [200, 200])
        self.assertEqual(blocked.status_code, 429)
        self.assertIn("Retry-After", blocked.headers)

    def test_a_visitor_over_the_limit_does_not_block_another(self):
        with limit(PublicReadThrottle, "1/min"):
            first = self.client.get(reverse("branch-list"), HTTP_CF_CONNECTING_IP="198.51.100.1")
            blocked = self.client.get(reverse("branch-list"), HTTP_CF_CONNECTING_IP="198.51.100.1")
            other = self.client.get(reverse("branch-list"), HTTP_CF_CONNECTING_IP="198.51.100.2")
        self.assertEqual([first.status_code, blocked.status_code, other.status_code], [200, 429, 200])

    def test_changing_x_forwarded_for_does_not_escape_the_limit(self):
        with limit(PublicReadThrottle, "1/min"):
            first = self.client.get(
                reverse("branch-list"),
                HTTP_CF_CONNECTING_IP="198.51.100.1", HTTP_X_FORWARDED_FOR="203.0.113.1",
            )
            spoofed = self.client.get(
                reverse("branch-list"),
                HTTP_CF_CONNECTING_IP="198.51.100.1", HTTP_X_FORWARDED_FOR="203.0.113.2",
            )
        self.assertEqual([first.status_code, spoofed.status_code], [200, 429])

    def test_read_limit_leaves_room_for_a_full_site_build(self):
        # The website builds and revalidates pages from a few shared Vercel
        # addresses. A low limit would make it publish empty pages.
        throttle = PublicReadThrottle()
        self.assertEqual(
            throttle.rate, settings.REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"]["anon"]
        )
        self.assertGreaterEqual(
            throttle.num_requests / throttle.duration, 5, "at least 300 reads a minute"
        )


class WriteLimitTests(ThrottleTestCase):
    @classmethod
    def setUpTestData(cls):
        cls.branch = make_branch("alpha")
        cls.staff = User.objects.create_user(
            "staff", password="pw", is_staff=True, branch=cls.branch, role="branch_admin"
        )
        cls.finance = User.objects.create_user(
            "finance", password="pw", is_staff=True, branch=cls.branch, role="finance_admin"
        )

    def post_twice(self, user, url_name):
        self.client.force_authenticate(user)
        with limit(WriteThrottle, "1/min"):
            first = self.client.post(reverse(url_name), {}, format="json")
            second = self.client.post(reverse(url_name), {}, format="json")
        return first.status_code, second.status_code

    def test_giving_record_writes_are_limited(self):
        first, second = self.post_twice(self.finance, "givingrecord-list")
        self.assertEqual(first, 400)  # reached the view; the empty body is invalid
        self.assertEqual(second, 429)

    def test_daily_message_writes_are_limited(self):
        first, second = self.post_twice(self.staff, "dailymessage-list")
        self.assertNotEqual(first, 429)
        self.assertEqual(second, 429)

    def test_reads_do_not_use_up_the_write_limit(self):
        self.client.force_authenticate(self.staff)
        with limit(WriteThrottle, "1/min"):
            for _ in range(3):
                self.assertEqual(self.client.get(reverse("sermon-list")).status_code, 200)
            self.assertNotEqual(self.client.post(reverse("sermon-list"), {}, format="json").status_code, 429)

    def test_one_users_writes_do_not_limit_another(self):
        self.client.force_authenticate(self.staff)
        with limit(WriteThrottle, "1/min"):
            self.client.post(reverse("sermon-list"), {}, format="json")
            self.assertEqual(self.client.post(reverse("sermon-list"), {}, format="json").status_code, 429)
            other = User.objects.create_user(
                "other", password="pw", is_staff=True, branch=self.branch, role="branch_admin"
            )
            self.client.force_authenticate(other)
            self.assertNotEqual(self.client.post(reverse("sermon-list"), {}, format="json").status_code, 429)

    def test_signed_in_reads_have_their_own_limit(self):
        self.client.force_authenticate(self.staff)
        with limit(StaffThrottle, "1/min"):
            first = self.client.get(reverse("sermon-list"))
            blocked = self.client.get(reverse("sermon-list"))
        self.assertEqual([first.status_code, blocked.status_code], [200, 429])


class LoginEndpointTests(ThrottleTestCase):
    """Nothing uses JWT login, and it has no lockout, so it must not be exposed."""

    def test_login_and_refresh_routes_are_gone(self):
        for path in ("/api/auth/login/", "/api/auth/refresh/"):
            with self.subTest(path=path):
                self.assertEqual(
                    self.client.post(path, {"username": "x", "password": "y"}, format="json").status_code,
                    404,
                )
        with self.assertRaises(NoReverseMatch):
            reverse("token_obtain_pair")
