"""Asking for access, approval, and setting a password (AGENT_EXECUTION_PLAN.md, Task 7.2).

1. Anyone asks for access through the website (its server passes the request on).
2. A superuser approves ministers; a branch's minister (Branch Admin) approves
   other staff of their own branch (decision D2). Approving makes the account
   with no usable password, and a single-use link that lasts 72 hours.
3. The person opens the link and chooses their password.
The link is shown once to the approver, to send by WhatsApp or SMS (D3)."""
from datetime import timedelta

from django.core.cache import cache
from django.test import override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase

from church_erp.accounts.models import AccessRequest, PasswordLink, User
from church_erp.core.models import Minister, StaffChange
from church_erp.core.tests.helpers import make_branch

SECRET = "website-secret"
ASK = reverse("access-request")
REQUESTS = reverse("staff-requests-list")
CHECK = reverse("auth-password-link-check")
USE = reverse("auth-password-link-use")
GOOD_PASSWORD = "Shepherd-Psalm-23-green"


def request_detail(pk):
    return reverse("staff-requests-detail", args=[pk])


def approve_url(pk):
    return reverse("staff-requests-approve", args=[pk])


def turn_down_url(pk):
    return reverse("staff-requests-turn-down", args=[pk])


@override_settings(INTERNAL_API_SECRET=SECRET)
class AccessTestCase(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.alpha = make_branch("alpha")
        cls.beta = make_branch("beta")
        cls.boss = User.objects.create_superuser("boss", password="pw")
        cls.minister_a = User.objects.create_user("rev_a", password="pw", is_staff=True, branch=cls.alpha, role="branch_admin")
        cls.editor_a = User.objects.create_user("editor_a", password="pw", is_staff=True, branch=cls.alpha, role="content_editor")
        cls.banda = Minister.objects.create(branch=cls.alpha, name="Banda", order=3)

    def setUp(self):
        cache.clear()
        self.addCleanup(cache.clear)

    def from_website(self, url, data, address="203.0.113.7"):
        self.client.force_authenticate(None)
        return self.client.post(url, data, format="json", HTTP_X_INTERNAL_SECRET=SECRET, HTTP_X_CLIENT_ADDRESS=address)

    def ask(self, **extra):
        address = extra.pop("address", "203.0.113.7")
        values = {
            "full_name": "Grace Banda", "email": "grace@example.org", "phone": "+260 97 123 4567",
            "branch": "alpha", "kind": "minister", "note": "Minister at Alpha since 2019.", **extra,
        }
        return self.from_website(ASK, values, address=address)

    def waiting(self, **extra):
        values = {"full_name": "Grace Banda", "email": "grace@example.org", "phone": "0971234567",
                  "branch": self.alpha, "kind": "minister", **extra}
        return AccessRequest.objects.create(**values)


class AskingTests(AccessTestCase):
    def test_a_request_is_kept_and_the_answer_says_nothing_more(self):
        response = self.ask()
        self.assertEqual(response.status_code, 202)
        self.assertEqual(response.json(), {"received": True})
        request = AccessRequest.objects.get()
        self.assertEqual((request.full_name, request.branch, request.kind, request.status),
                         ("Grace Banda", self.alpha, "minister", "waiting"))
        self.assertFalse(User.objects.filter(email="grace@example.org").exists())

    def test_only_the_website_server_can_pass_requests_on(self):
        response = self.client.post(ASK, {"full_name": "X"}, format="json")
        self.assertEqual(response.status_code, 404)

    def test_details_are_checked(self):
        cases = {
            "full_name": "", "email": "not-an-email", "phone": "call me", "branch": "nowhere",
            "kind": "bishop", "note": "x" * 1001,
        }
        for number, (key, bad) in enumerate(cases.items()):
            with self.subTest(key):
                # Each from its own address: refused attempts count towards the hourly limit too.
                response = self.ask(**{key: bad}, address=f"203.0.113.{number + 20}")
                self.assertEqual(response.status_code, 400)
                self.assertIn(key, response.json())
        self.assertFalse(AccessRequest.objects.exists())

    def test_a_filled_in_hidden_box_is_treated_as_a_robot_and_quietly_dropped(self):
        response = self.ask(website="http://spam.example")
        self.assertEqual(response.status_code, 202)
        self.assertFalse(AccessRequest.objects.exists())

    def test_asking_twice_while_waiting_keeps_one_request(self):
        self.ask()
        response = self.ask(email="GRACE@example.org")
        self.assertEqual(response.status_code, 202)
        self.assertEqual(AccessRequest.objects.count(), 1)

    def test_one_address_can_only_ask_a_few_times_an_hour(self):
        statuses = [self.ask(email=f"p{i}@example.org").status_code for i in range(7)]
        self.assertEqual(statuses[:5], [202] * 5)
        self.assertEqual(statuses[5:], [429, 429])
        # Someone else isn't held back.
        self.assertEqual(self.ask(email="other@example.org", address="198.51.100.9").status_code, 202)

    def test_branches_taken_off_the_website_cant_be_chosen(self):
        self.beta.is_active = False
        self.beta.save()
        self.assertEqual(self.ask(branch="beta").status_code, 400)


class ReviewTests(AccessTestCase):
    def test_superusers_see_every_request(self):
        mine = self.waiting()
        other = self.waiting(email="b@example.org", branch=self.beta, kind="staff")
        self.client.force_authenticate(self.boss)
        ids = {row["id"] for row in self.client.get(REQUESTS).data["results"]}
        self.assertEqual(ids, {mine.pk, other.pk})

    def test_a_ministers_account_sees_only_their_branchs_staff_requests(self):
        staff_here = self.waiting(email="s@example.org", kind="staff")
        self.waiting(email="m@example.org", kind="minister")
        self.waiting(email="b@example.org", branch=self.beta, kind="staff")
        self.client.force_authenticate(self.minister_a)
        ids = {row["id"] for row in self.client.get(REQUESTS).data["results"]}
        self.assertEqual(ids, {staff_here.pk})

    def test_content_editors_and_strangers_are_refused(self):
        self.client.force_authenticate(self.editor_a)
        self.assertEqual(self.client.get(REQUESTS).status_code, 403)
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(REQUESTS).status_code, 401)

    def test_a_request_from_someone_who_already_has_an_account_says_so(self):
        request = self.waiting(email="EDITOR@example.org")
        self.editor_a.email = "editor@example.org"
        self.editor_a.save()
        self.client.force_authenticate(self.boss)
        self.assertEqual(self.client.get(request_detail(request.pk)).data["existing_account"], "editor_a")


class ApprovalTests(AccessTestCase):
    def approve(self, request, user=None, **values):
        self.client.force_authenticate(user or self.boss)
        return self.client.post(approve_url(request.pk), values, format="json")

    def test_approving_a_minister_makes_their_linked_branch_admin_account_and_a_link(self):
        request = self.waiting()
        response = self.approve(request, username="grace", minister=self.banda.pk)
        self.assertEqual(response.status_code, 201, response.data)
        account = User.objects.get(username="grace")
        self.assertEqual((account.role, account.branch, account.email), ("branch_admin", self.alpha, "grace@example.org"))
        self.assertEqual((account.first_name, account.last_name), ("Grace", "Banda"))
        self.assertFalse(account.has_usable_password())
        self.assertFalse(account.is_superuser)
        self.banda.refresh_from_db()
        self.assertEqual(self.banda.account, account)
        request.refresh_from_db()
        self.assertEqual((request.status, request.decided_by, request.account), ("approved", self.boss, account))
        token = response.data["link_token"]
        self.assertGreater(len(token), 30)
        link = PasswordLink.objects.get(user=account)
        self.assertNotIn(token, link.token_hash)  # only a hash is kept
        self.assertAlmostEqual(link.expires_at, timezone.now() + timedelta(hours=72), delta=timedelta(minutes=1))
        actions = list(StaffChange.objects.values_list("section", "action"))
        self.assertIn(("requests", "approved"), actions)
        self.assertIn(("people", "set-password link made"), actions)

    def test_a_minister_can_be_made_from_the_request_when_they_have_no_profile_yet(self):
        request = self.waiting(full_name="Joseph Mwale")
        response = self.approve(request, username="mwale", minister="new")
        self.assertEqual(response.status_code, 201, response.data)
        profile = Minister.objects.get(name="Joseph Mwale")
        self.assertEqual((profile.branch, profile.account.username), (self.alpha, "mwale"))
        # It goes after the branch's ministers, so the About page's main minister doesn't change.
        self.assertGreater(profile.order, self.banda.order)
        self.assertEqual(Minister.objects.filter(branch=self.alpha).first(), self.banda)

    def test_a_minister_request_must_be_linked_to_a_minister_of_that_branch(self):
        other = Minister.objects.create(branch=self.beta, name="Phiri")
        for values in ({}, {"minister": other.pk}):
            with self.subTest(values):
                response = self.approve(self.waiting(email=f"x{len(values)}@example.org"), username=f"x{len(values)}", **values)
                self.assertEqual(response.status_code, 400)
                self.assertIn("minister", response.data)
        self.assertFalse(User.objects.filter(username__startswith="x").exists())

    def test_superusers_approve_other_staff_with_the_role_and_branch_they_choose(self):
        request = self.waiting(kind="staff", email="s@example.org")
        response = self.approve(request, username="sec", role="content_editor", branch="beta")
        self.assertEqual(response.status_code, 201, response.data)
        account = User.objects.get(username="sec")
        self.assertEqual((account.role, account.branch), ("content_editor", self.beta))

    def test_a_ministers_account_approves_its_own_branchs_staff_as_content_editors_only(self):
        request = self.waiting(kind="staff", email="s@example.org")
        response = self.approve(request, user=self.minister_a, username="sec", role="branch_admin", branch="beta")
        self.assertEqual(response.status_code, 201, response.data)
        account = User.objects.get(username="sec")
        self.assertEqual((account.role, account.branch), ("content_editor", self.alpha))

    def test_a_ministers_account_cant_approve_ministers_or_other_branches(self):
        for request in (self.waiting(), self.waiting(kind="staff", email="b@example.org", branch=self.beta)):
            with self.subTest(request.kind):
                response = self.approve(request, user=self.minister_a, username=f"u{request.pk}")
                self.assertEqual(response.status_code, 404)
        self.assertFalse(User.objects.filter(username__startswith="u").exists())

    def test_usernames_must_be_free(self):
        response = self.approve(self.waiting(kind="staff"), username="EDITOR_A", role="content_editor")
        self.assertEqual(response.status_code, 400)
        self.assertIn("username", response.data)

    def test_a_decided_request_cant_be_decided_again(self):
        request = self.waiting(kind="staff")
        self.approve(request, username="first", role="content_editor")
        again = self.approve(request, username="second", role="content_editor")
        self.assertEqual(again.status_code, 409)
        self.assertFalse(User.objects.filter(username="second").exists())
        self.assertEqual(self.client.post(turn_down_url(request.pk), {}, format="json").status_code, 409)

    def test_turning_down_keeps_the_request_with_a_reason(self):
        request = self.waiting()
        self.client.force_authenticate(self.boss)
        response = self.client.post(turn_down_url(request.pk), {"reason": "Not known to the branch."}, format="json")
        self.assertEqual(response.status_code, 200)
        request.refresh_from_db()
        self.assertEqual((request.status, request.reason, request.decided_by), ("turned_down", "Not known to the branch.", self.boss))
        self.assertFalse(User.objects.filter(email="grace@example.org").exists())
        self.assertIn(("requests", "turned down"), list(StaffChange.objects.values_list("section", "action")))


class PasswordLinkTests(AccessTestCase):
    def link_for(self, user, **extra):
        from church_erp.accounts.password_links import make_link
        return make_link(user, made_by=self.boss, **extra)

    def new_account(self):
        user = User.objects.create_user("grace", email="g@example.org", is_staff=True, branch=self.alpha, role="branch_admin")
        user.set_unusable_password()
        user.save()
        return user

    def test_the_link_says_whose_it_is_and_then_sets_the_password_once(self):
        user = self.new_account()
        token = self.link_for(user)
        check = self.from_website(CHECK, {"token": token})
        self.assertEqual(check.status_code, 200)
        self.assertEqual(check.json(), {"username": "grace", "first_name": ""})
        used = self.from_website(USE, {"token": token, "password": GOOD_PASSWORD})
        self.assertEqual(used.status_code, 200, used.content)
        user.refresh_from_db()
        self.assertTrue(user.check_password(GOOD_PASSWORD))
        self.assertFalse(user.must_change_password)
        self.assertEqual(self.from_website(USE, {"token": token, "password": "Another-long-pass-99"}).status_code, 404)
        self.assertEqual(self.from_website(CHECK, {"token": token}).status_code, 404)
        self.assertIn(("people", "password set"), list(StaffChange.objects.values_list("section", "action")))

    def test_expired_wrong_and_replaced_links_are_refused_alike(self):
        user = self.new_account()
        old = self.link_for(user)
        new = self.link_for(user)  # making a new link cancels the old one
        PasswordLink.objects.filter(user=user).update(expires_at=timezone.now() - timedelta(seconds=1))
        for token in (old, new, "made-up-token", ""):
            with self.subTest(token=token[:6]):
                response = self.from_website(CHECK, {"token": token})
                self.assertEqual(response.status_code, 404)
                self.assertIn("expired", response.json()["detail"])

    def test_a_new_link_cancels_the_old_one(self):
        user = self.new_account()
        old = self.link_for(user)
        new = self.link_for(user)
        self.assertEqual(self.from_website(CHECK, {"token": old}).status_code, 404)
        self.assertEqual(self.from_website(CHECK, {"token": new}).status_code, 200)

    def test_suspended_accounts_cant_use_a_link(self):
        user = self.new_account()
        token = self.link_for(user)
        user.is_active = False
        user.save()
        self.assertEqual(self.from_website(USE, {"token": token, "password": GOOD_PASSWORD}).status_code, 404)

    def test_weak_passwords_are_refused_and_the_link_still_works(self):
        user = self.new_account()
        token = self.link_for(user)
        for weak in ("short", "password123", "grace"):
            with self.subTest(weak):
                response = self.from_website(USE, {"token": token, "password": weak})
                self.assertEqual(response.status_code, 400)
                self.assertIn("password", response.json())
        self.assertEqual(self.from_website(CHECK, {"token": token}).status_code, 200)

    def test_only_the_website_server_can_check_or_use_links(self):
        token = self.link_for(self.new_account())
        self.assertEqual(self.client.post(CHECK, {"token": token}, format="json").status_code, 404)
        self.assertEqual(self.client.post(USE, {"token": token, "password": GOOD_PASSWORD}, format="json").status_code, 404)

    def test_guessing_links_is_slowed_down(self):
        statuses = {self.from_website(CHECK, {"token": f"guess-{i}"}).status_code for i in range(35)}
        self.assertIn(429, statuses)

    def test_setting_a_password_signs_them_out_elsewhere(self):
        from unittest import mock
        user = self.new_account()
        token = self.link_for(user)
        with mock.patch("church_erp.accounts.password_links.two_factor.end_sessions") as end:
            self.from_website(USE, {"token": token, "password": GOOD_PASSWORD})
        end.assert_called_once_with(user)
