"""Two-step login (AGENT_EXECUTION_PLAN.md, Task 5.1)."""
import time
from io import StringIO
from unittest.mock import patch

from django.conf import settings
from django.core.cache import cache
from django.core.management import CommandError, call_command
from django.test import TestCase, override_settings
from django.urls import reverse
from django_otp.oath import totp
from django_otp.plugins.otp_static.models import StaticDevice, StaticToken
from django_otp.plugins.otp_totp.models import TOTPDevice
from rest_framework.test import APITestCase

from church_erp.accounts.models import User
from church_erp.accounts.two_factor import CHALLENGE_MAX_AGE, read_challenge
from church_erp.core.tests.helpers import make_branch

SECRET = "test-internal-secret-0123456789"
PASSWORD = "correct-horse-battery"


def current_code(device):
    """The code an authenticator app would show now, allowed to be used again."""
    TOTPDevice.objects.filter(pk=device.pk).update(last_t=-1)
    device.refresh_from_db()
    return str(totp(device.bin_key, step=device.step, t0=device.t0, digits=device.digits)).zfill(device.digits)


def enable_two_factor(user, recovery_code=None):
    device = TOTPDevice.objects.create(user=user, name="default", confirmed=True)
    if recovery_code:
        static = StaticDevice.objects.create(user=user, name="recovery", confirmed=True)
        StaticToken.objects.create(device=static, token=recovery_code)
    return device


@override_settings(INTERNAL_API_SECRET=SECRET, REQUIRE_TWO_FACTOR=True, OTP_TOTP_THROTTLE_FACTOR=0)
class TwoFactorTestCase(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.branch = make_branch("alpha")
        cls.manager = User.objects.create_user(
            "manager", password=PASSWORD, is_staff=True, branch=cls.branch, role="branch_admin",
        )
        cls.editor = User.objects.create_user(
            "editor", password=PASSWORD, is_staff=True, branch=cls.branch, role="content_editor",
        )
        cls.root = User.objects.create_superuser("root", password=PASSWORD)

    def setUp(self):
        cache.clear()
        self.addCleanup(cache.clear)

    def server_post(self, name, data=None, address="198.51.100.1"):
        return self.client.post(
            reverse(name), data or {}, format="json",
            HTTP_X_INTERNAL_SECRET=SECRET, HTTP_X_CLIENT_ADDRESS=address,
        )

    def login(self, username="manager", password=PASSWORD, address="198.51.100.1"):
        return self.server_post("auth-login", {"username": username, "password": password}, address)

    def verify(self, challenge, code, address="198.51.100.1"):
        return self.server_post("auth-login-verify", {"challenge": challenge, "code": code}, address)

    def bearer(self, access):
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")


class SignInWithTwoFactorTests(TwoFactorTestCase):
    def setUp(self):
        super().setUp()
        self.device = enable_two_factor(self.manager, recovery_code="recoverycode1234")

    def challenge(self):
        response = self.login()
        self.assertEqual(response.status_code, 200, response.content)
        return response.data["challenge"]

    def test_the_right_password_alone_gives_no_tokens(self):
        response = self.login()
        self.assertIs(response.data["two_factor_required"], True)
        self.assertNotIn("access", response.data)
        self.assertNotIn("refresh", response.data)

    def test_a_wrong_password_never_reaches_the_second_step(self):
        response = self.login(password="wrong")
        self.assertEqual(response.status_code, 401)
        self.assertNotIn("challenge", response.data)

    def test_the_right_code_gives_tokens(self):
        response = self.verify(self.challenge(), current_code(self.device))
        self.assertEqual(response.status_code, 200, response.content)
        self.bearer(response.data["access"])
        me = self.client.get(reverse("auth-me"))
        self.assertEqual(me.status_code, 200)
        self.assertIs(me.data["two_factor_enabled"], True)
        self.assertIs(me.data["must_set_up_two_factor"], False)

    def test_a_wrong_code_gives_nothing(self):
        response = self.verify(self.challenge(), "000000")
        self.assertEqual(response.status_code, 401)
        self.assertNotIn("access", response.data)

    def test_a_code_works_only_once(self):
        code = current_code(self.device)
        self.assertEqual(self.verify(self.challenge(), code).status_code, 200)
        self.assertEqual(self.verify(self.challenge(), code).status_code, 401)

    def test_a_recovery_code_works_once_however_it_is_typed(self):
        self.assertEqual(self.verify(self.challenge(), " RECOVERY CODE1234 ").status_code, 200)
        self.assertEqual(self.verify(self.challenge(), "recoverycode1234").status_code, 401)
        self.assertFalse(StaticToken.objects.exists())

    def test_someone_elses_code_does_not_work(self):
        other = enable_two_factor(self.editor)
        self.assertEqual(self.verify(self.challenge(), current_code(other)).status_code, 401)

    def test_a_challenge_is_not_a_token(self):
        self.bearer(self.challenge())
        self.assertEqual(self.client.get(reverse("auth-me")).status_code, 401)

    def test_a_tampered_challenge_is_refused(self):
        self.assertEqual(self.verify(self.challenge() + "x", current_code(self.device)).status_code, 401)

    def test_an_old_challenge_is_refused(self):
        # Checked directly: moving the clock through the API would also invalidate the code.
        challenge = self.challenge()
        now = time.time()
        with patch("django.core.signing.time.time", return_value=now + CHALLENGE_MAX_AGE - 5):
            self.assertEqual(read_challenge(challenge), self.manager)
        with patch("django.core.signing.time.time", return_value=now + CHALLENGE_MAX_AGE + 5):
            self.assertIsNone(read_challenge(challenge))

    def test_a_challenge_ends_when_the_password_changes(self):
        challenge = self.challenge()
        self.manager.set_password("a-new-password-for-this-test")
        self.manager.save()
        self.assertEqual(self.verify(challenge, current_code(self.device)).status_code, 401)

    def test_suspending_someone_ends_their_challenge(self):
        challenge = self.challenge()
        User.objects.filter(pk=self.manager.pk).update(is_active=False)
        self.assertEqual(self.verify(challenge, current_code(self.device)).status_code, 401)

    def test_the_second_step_only_answers_the_website_server(self):
        response = self.client.post(
            reverse("auth-login-verify"),
            {"challenge": self.challenge(), "code": current_code(self.device)}, format="json",
        )
        self.assertEqual(response.status_code, 404)

    def test_too_many_wrong_codes_lock_the_account(self):
        challenge = self.challenge()
        for _ in range(settings.AXES_FAILURE_LIMIT):
            self.verify(challenge, "000000")
        self.assertEqual(self.verify(challenge, current_code(self.device)).status_code, 429)

    def test_a_locked_account_cannot_start_again_with_the_password(self):
        challenge = self.challenge()
        for _ in range(settings.AXES_FAILURE_LIMIT):
            self.verify(challenge, "000000")
        self.assertEqual(self.login().status_code, 429)

    def test_rotating_addresses_does_not_avoid_the_code_lockout(self):
        challenge = self.challenge()
        for number in range(settings.AXES_FAILURE_LIMIT):
            self.verify(challenge, "000000", address=f"198.51.100.{number + 1}")
        self.assertEqual(self.verify(challenge, current_code(self.device), address="203.0.113.9").status_code, 429)

    def test_a_good_code_clears_earlier_mistakes(self):
        challenge = self.challenge()
        for _ in range(settings.AXES_FAILURE_LIMIT - 1):
            self.verify(challenge, "000000")
        self.assertEqual(self.verify(challenge, current_code(self.device)).status_code, 200)
        challenge = self.challenge()
        for _ in range(settings.AXES_FAILURE_LIMIT - 1):
            self.verify(challenge, "000000")
        self.assertEqual(self.verify(challenge, current_code(self.device)).status_code, 200)

    @override_settings(OTP_TOTP_THROTTLE_FACTOR=1)
    def test_a_mistyped_app_code_does_not_slow_down_recovery_codes(self):
        challenge = self.challenge()
        self.verify(challenge, "000000")
        self.assertEqual(self.verify(challenge, "recoverycode1234").status_code, 200)

    @override_settings(OTP_TOTP_THROTTLE_FACTOR=1)
    def test_codes_slow_down_after_a_wrong_guess(self):
        challenge = self.challenge()
        self.verify(challenge, "000000")
        code = str(totp(self.device.bin_key)).zfill(6)
        self.assertEqual(self.verify(challenge, code).status_code, 401)


class RequiredSetUpTests(TwoFactorTestCase):
    def test_required_roles_must_set_it_up(self):
        for username in ("manager", "root"):
            with self.subTest(username=username):
                self.bearer(self.login(username).data["access"])
                self.assertIs(self.client.get(reverse("auth-me")).data["must_set_up_two_factor"], True)

    def test_nothing_else_works_until_it_is_set_up(self):
        self.bearer(self.login().data["access"])
        response = self.client.post(reverse("sermon-list"), {}, format="json")
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.data["detail"].code, "two_factor_setup_required")
        self.assertEqual(self.client.get(reverse("sermon-list")).status_code, 403)

    def test_setting_it_up_stays_possible(self):
        self.bearer(self.login().data["access"])
        self.assertEqual(self.client.get(reverse("auth-two-factor-setup")).status_code, 200)

    def test_other_roles_are_not_forced(self):
        self.bearer(self.login("editor").data["access"])
        me = self.client.get(reverse("auth-me"))
        self.assertIs(me.data["must_set_up_two_factor"], False)
        self.assertIs(me.data["two_factor_enabled"], False)
        self.assertNotEqual(self.client.post(reverse("sermon-list"), {}, format="json").status_code, 403)

    @override_settings(REQUIRE_TWO_FACTOR=False)
    def test_the_requirement_can_be_off(self):
        self.bearer(self.login().data["access"])
        self.assertIs(self.client.get(reverse("auth-me")).data["must_set_up_two_factor"], False)


class SetUpTests(TwoFactorTestCase):
    def start(self, username="manager"):
        self.bearer(self.login(username).data["access"])
        response = self.client.get(reverse("auth-two-factor-setup"))
        self.assertEqual(response.status_code, 200, response.content)
        return response.data

    def confirm(self, code):
        return self.client.post(reverse("auth-two-factor-confirm"), {"code": code}, format="json")

    def pending(self):
        return TOTPDevice.objects.get(user=self.manager, confirmed=False)

    def test_gives_what_an_authenticator_app_needs(self):
        data = self.start()
        self.assertTrue(data["otpauth_url"].startswith("otpauth://totp/"))
        self.assertIn(settings.OTP_TOTP_ISSUER.replace(" ", "%20"), data["otpauth_url"])
        self.assertTrue(data["qr_code"].startswith("data:image/svg+xml;base64,"))
        self.assertRegex(data["key"], r"^[A-Z2-7]+$")

    def test_reloading_the_page_keeps_the_same_key(self):
        self.assertEqual(self.start()["key"], self.client.get(reverse("auth-two-factor-setup")).data["key"])
        self.assertEqual(TOTPDevice.objects.filter(user=self.manager).count(), 1)

    def test_an_unfinished_set_up_does_not_count(self):
        self.start()
        self.client.credentials()
        self.assertIn("access", self.login().data)

    def test_a_wrong_code_does_not_turn_it_on(self):
        self.start()
        response = self.confirm("000000")
        self.assertEqual(response.status_code, 400)
        self.assertIn("code", response.data)
        self.assertFalse(TOTPDevice.objects.filter(user=self.manager, confirmed=True).exists())

    def test_the_right_code_turns_it_on_and_gives_recovery_codes(self):
        self.start()
        response = self.confirm(current_code(self.pending()))
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(len(response.data["recovery_codes"]), 10)
        self.assertEqual(len(set(response.data["recovery_codes"])), 10)
        self.assertTrue(TOTPDevice.objects.filter(user=self.manager, confirmed=True).exists())
        self.bearer(response.data["access"])
        me = self.client.get(reverse("auth-me"))
        self.assertIs(me.data["two_factor_enabled"], True)
        self.assertIs(me.data["must_set_up_two_factor"], False)
        self.assertNotEqual(self.client.post(reverse("sermon-list"), {}, format="json").status_code, 403)

    def test_the_recovery_codes_it_gives_really_work(self):
        self.start()
        codes = self.confirm(current_code(self.pending())).data["recovery_codes"]
        self.client.credentials()
        self.assertEqual(self.verify(self.login().data["challenge"], codes[0]).status_code, 200)

    def test_turning_it_on_ends_sessions_started_with_only_a_password(self):
        elsewhere = self.login().data
        self.start()
        self.confirm(current_code(self.pending()))
        self.client.credentials()
        self.assertEqual(self.server_post("auth-refresh", {"refresh": elsewhere["refresh"]}).status_code, 401)

    def test_it_cannot_be_replaced_once_on(self):
        # Otherwise someone in a stolen session could swap in their own phone.
        device = enable_two_factor(self.manager)
        self.bearer(self.verify(self.login().data["challenge"], current_code(device)).data["access"])
        self.assertEqual(self.client.get(reverse("auth-two-factor-setup")).status_code, 409)
        self.assertEqual(self.confirm(current_code(device)).status_code, 409)
        self.assertEqual(TOTPDevice.objects.filter(user=self.manager).count(), 1)

    def test_signed_out_is_refused(self):
        self.assertEqual(self.client.get(reverse("auth-two-factor-setup")).status_code, 401)
        self.assertEqual(self.confirm("000000").status_code, 401)


class ResetCommandTests(TwoFactorTestCase):
    def test_removes_devices_and_sessions_so_they_set_it_up_again(self):
        device = enable_two_factor(self.manager, recovery_code="recoverycode1234")
        tokens = self.verify(self.login().data["challenge"], current_code(device)).data
        out = StringIO()
        call_command("reset_two_factor", "manager", stdout=out)
        self.assertIn("manager", out.getvalue())
        self.assertFalse(TOTPDevice.objects.filter(user=self.manager).exists())
        self.assertFalse(StaticDevice.objects.filter(user=self.manager).exists())
        self.assertEqual(self.server_post("auth-refresh", {"refresh": tokens["refresh"]}).status_code, 401)
        self.assertIn("access", self.login().data)

    def test_leaves_other_people_alone(self):
        enable_two_factor(self.editor)
        call_command("reset_two_factor", "manager", stdout=StringIO())
        self.assertTrue(TOTPDevice.objects.filter(user=self.editor).exists())

    def test_an_unknown_username_is_an_error(self):
        with self.assertRaises(CommandError):
            call_command("reset_two_factor", "nobody", stdout=StringIO())


@override_settings(REQUIRE_TWO_FACTOR=True, OTP_TOTP_THROTTLE_FACTOR=0)
class DjangoAdminTests(TestCase):
    """The old admin must not be a way around two-step login."""

    @classmethod
    def setUpTestData(cls):
        cls.branch = make_branch("alpha")
        cls.root = User.objects.create_superuser("root", password=PASSWORD)
        cls.editor = User.objects.create_user(
            "editor", password=PASSWORD, is_staff=True, branch=cls.branch, role="content_editor",
        )
        cls.index = reverse("admin:index")

    def sign_in(self, username, code=""):
        return self.client.post(reverse("admin:login"), {
            "username": username, "password": PASSWORD, "otp_token": code, "next": self.index,
        })

    def assertSignedIn(self):
        self.assertEqual(self.client.get(self.index).status_code, 200)

    def assertNotSignedIn(self):
        response = self.client.get(self.index)
        self.assertEqual(response.status_code, 302)
        self.assertIn("login", response["Location"])

    def test_required_roles_without_it_are_sent_to_set_it_up(self):
        response = self.sign_in("root")
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "dashboard")
        self.assertNotSignedIn()

    def test_a_password_alone_is_not_enough_once_it_is_on(self):
        enable_two_factor(self.root)
        self.assertEqual(self.sign_in("root").status_code, 200)
        self.assertNotSignedIn()

    def test_a_wrong_code_is_refused(self):
        enable_two_factor(self.root)
        self.assertEqual(self.sign_in("root", "000000").status_code, 200)
        self.assertNotSignedIn()

    def test_the_right_code_gets_in(self):
        device = enable_two_factor(self.root)
        self.assertEqual(self.sign_in("root", current_code(device)).status_code, 302)
        self.assertSignedIn()

    def test_a_session_without_a_code_is_refused(self):
        enable_two_factor(self.root)
        self.client.force_login(self.root)
        self.assertNotSignedIn()

    def test_other_roles_can_still_use_a_password_alone(self):
        self.assertEqual(self.sign_in("editor").status_code, 302)
        self.assertSignedIn()

    def test_other_roles_need_the_code_if_they_turned_it_on(self):
        device = enable_two_factor(self.editor)
        self.assertEqual(self.sign_in("editor").status_code, 200)
        self.assertNotSignedIn()
        self.assertEqual(self.sign_in("editor", current_code(device)).status_code, 302)
        self.assertSignedIn()

    def test_a_recovery_code_gets_in(self):
        enable_two_factor(self.root, recovery_code="recoverycode1234")
        self.assertEqual(self.sign_in("root", "RECOVERY CODE1234").status_code, 302)
        self.assertSignedIn()

    def test_the_sign_in_page_asks_for_one_simple_code(self):
        response = self.client.get(reverse("admin:login"))
        self.assertContains(response, 'name="otp_token"')
        self.assertContains(response, "Two-step code")
        self.assertNotContains(response, "otp_device")
        self.assertNotContains(response, "otp_challenge")

    def test_device_secrets_are_hidden_even_from_superusers(self):
        device = enable_two_factor(self.root)
        self.sign_in("root", current_code(device))
        response = self.client.get(reverse("admin:otp_totp_totpdevice_change", args=[device.pk]))
        self.assertEqual(response.status_code, 200)
        self.assertNotContains(response, device.key)
