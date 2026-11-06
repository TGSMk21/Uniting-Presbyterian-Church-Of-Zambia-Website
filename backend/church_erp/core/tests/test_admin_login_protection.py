"""Protecting the admin login page (AGENT_EXECUTION_PLAN.md, Phase 6)."""
import json
import os
import subprocess
import sys
from datetime import timedelta
from pathlib import Path

from axes.models import AccessAttempt
from django.conf import settings
from django.test import SimpleTestCase, TestCase
from django.urls import reverse
from django.utils import timezone

from church_erp.accounts.models import User

BACKEND_DIR = Path(__file__).resolve().parents[3]


class LoginLockoutTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_superuser("root", password="right-password")
        cls.other = User.objects.create_superuser("other", password="other-password")

    def attempt(self, username, password, address="198.51.100.1"):
        return self.client.post(
            reverse("admin:login"),
            {"username": username, "password": password, "next": "/"},
            HTTP_CF_CONNECTING_IP=address,
        )

    def fail(self, times, username="root", **kwargs):
        for _ in range(times):
            self.attempt(username, "wrong", **kwargs)

    def test_a_correct_password_still_works_after_a_few_mistakes(self):
        self.fail(settings.AXES_FAILURE_LIMIT - 1)
        self.assertEqual(self.attempt("root", "right-password").status_code, 302)

    def test_too_many_failures_lock_the_account_even_for_the_right_password(self):
        self.fail(settings.AXES_FAILURE_LIMIT)
        response = self.attempt("root", "right-password")
        self.assertEqual(response.status_code, 429)
        self.assertNotIn("_auth_user_id", self.client.session)

    def test_guessing_from_many_addresses_still_locks_the_account(self):
        for number in range(settings.AXES_FAILURE_LIMIT):
            self.attempt("root", "wrong", address=f"198.51.100.{number + 1}")
        self.assertEqual(self.attempt("root", "right-password", address="203.0.113.9").status_code, 429)

    def test_another_account_is_not_affected(self):
        self.fail(settings.AXES_FAILURE_LIMIT)
        self.assertEqual(
            self.attempt("other", "other-password", address="203.0.113.50").status_code, 302
        )

    def test_trying_many_usernames_from_one_address_locks_the_address(self):
        for number in range(settings.AXES_FAILURE_LIMIT):
            self.attempt(f"guess{number}", "wrong")
        self.assertEqual(self.attempt("root", "right-password").status_code, 429)
        self.assertEqual(
            self.attempt("root", "right-password", address="203.0.113.50").status_code, 302
        )

    def test_the_lock_lifts_by_itself(self):
        self.fail(settings.AXES_FAILURE_LIMIT)
        self.assertEqual(self.attempt("root", "right-password").status_code, 429)
        AccessAttempt.objects.update(
            attempt_time=timezone.now() - settings.AXES_COOLOFF_TIME - timedelta(minutes=1)
        )
        self.assertEqual(self.attempt("root", "right-password").status_code, 302)

    def test_a_successful_login_clears_earlier_mistakes(self):
        self.fail(settings.AXES_FAILURE_LIMIT - 1)
        self.attempt("root", "right-password")
        self.client.logout()
        self.fail(settings.AXES_FAILURE_LIMIT - 1)
        self.assertEqual(self.attempt("root", "right-password").status_code, 302)

    def test_failures_record_the_visitors_address_not_the_proxys(self):
        self.fail(1, address="198.51.100.7")
        self.assertEqual(AccessAttempt.objects.get().ip_address, "198.51.100.7")

    def test_the_lockout_limit_is_sensible(self):
        self.assertLessEqual(settings.AXES_FAILURE_LIMIT, 10)
        self.assertLessEqual(settings.AXES_COOLOFF_TIME, timedelta(hours=1))


READ_ADMIN_URL = """
import django
django.setup()
from django.urls import reverse
print(reverse("admin:index"))
"""


class AdminAddressTests(SimpleTestCase):
    """Settings load once per process, so each case runs a fresh interpreter."""

    def admin_url(self, value):
        env = {
            **os.environ,
            "DJANGO_SETTINGS_MODULE": "church_erp.settings.test",
            "DJANGO_ADMIN_PATH": value,
        }
        result = subprocess.run(
            [sys.executable, "-c", READ_ADMIN_URL],
            cwd=BACKEND_DIR, env=env, capture_output=True, text=True, timeout=60,
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        return result.stdout.strip().splitlines()[-1]

    def test_default_address_is_unchanged(self):
        self.assertEqual(self.admin_url(""), "/admin/")

    def test_address_can_be_moved(self):
        self.assertEqual(self.admin_url("manage-upcz"), "/manage-upcz/")

    def test_slashes_are_tidied(self):
        self.assertEqual(self.admin_url("/manage-upcz/"), "/manage-upcz/")

    def test_a_lone_slash_can_not_put_the_admin_on_the_home_page(self):
        self.assertEqual(self.admin_url("/"), "/admin/")
