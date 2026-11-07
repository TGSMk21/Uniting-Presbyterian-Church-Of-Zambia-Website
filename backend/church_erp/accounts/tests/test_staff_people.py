"""Managing staff from the dashboard (AGENT_EXECUTION_PLAN.md, Task 5.4).

Branch admins add, suspend and restore their own branch's content editors.
Superusers manage every branch's staff. Nobody manages superusers or
themselves here."""
from django.core.management import call_command
from django.core.cache import cache
from django.urls import reverse
from django_otp.plugins.otp_totp.models import TOTPDevice
from rest_framework.test import APITestCase
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken
from rest_framework_simplejwt.tokens import RefreshToken

from church_erp.accounts.models import User
from church_erp.core.models import StaffChange
from church_erp.core.tests.helpers import make_branch


def person(username, branch=None, role="content_editor", **extra):
    return User.objects.create_user(username, password="pw-Long-enough-1", is_staff=True, branch=branch, role=role, **extra)


LIST = reverse("staff-people-list")


def detail(pk):
    return reverse("staff-people-detail", args=[pk])


def act(pk, name):
    return reverse(f"staff-people-{name}", args=[pk])


class PeopleTestCase(APITestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("setup_roles", verbosity=0)
        cls.alpha = make_branch("alpha")
        cls.beta = make_branch("beta")
        cls.boss = User.objects.create_superuser("boss", password="pw-Long-enough-1")
        cls.admin_a = person("admin_a", cls.alpha, role="branch_admin")
        cls.editor_a = person("editor_a", cls.alpha)
        cls.admin_b = person("admin_b", cls.beta, role="branch_admin")
        cls.editor_b = person("editor_b", cls.beta)
        cls.treasurer_a = person("treasurer_a", cls.alpha, role="finance_admin")

    def setUp(self):
        # Staff saves are rate limited per account; start each test afresh.
        cache.clear()
        self.addCleanup(cache.clear)

    def usernames(self, response):
        return sorted(row["username"] for row in response.data["results"])

    def new(self, **extra):
        return {"username": "newbie", "first_name": "Grace", "last_name": "Phiri", "email": "grace@example.org", **extra}


class WhoCanSeeTests(PeopleTestCase):
    def test_signed_out_and_other_roles_are_refused(self):
        self.assertEqual(self.client.get(LIST).status_code, 401)
        for user in (self.editor_a, self.treasurer_a):
            self.client.force_authenticate(user)
            self.assertEqual(self.client.get(LIST).status_code, 403, user.username)

    def test_branch_admin_sees_own_branch_admins_and_editors_only(self):
        self.client.force_authenticate(self.admin_a)
        self.assertEqual(self.usernames(self.client.get(LIST)), ["admin_a", "editor_a"])
        self.assertEqual(self.client.get(detail(self.editor_b.pk)).status_code, 404)
        self.assertEqual(self.client.get(detail(self.treasurer_a.pk)).status_code, 404)
        self.assertEqual(self.client.get(detail(self.boss.pk)).status_code, 404)

    def test_superuser_sees_everyone_and_can_filter_by_branch(self):
        self.client.force_authenticate(self.boss)
        self.assertEqual(
            self.usernames(self.client.get(LIST)),
            ["admin_a", "admin_b", "boss", "editor_a", "editor_b", "treasurer_a"],
        )
        self.assertEqual(self.usernames(self.client.get(LIST, {"branch": "beta"})), ["admin_b", "editor_b"])

    def test_rows_say_who_the_viewer_can_manage(self):
        self.client.force_authenticate(self.admin_a)
        rows = {row["username"]: row for row in self.client.get(LIST).data["results"]}
        self.assertTrue(rows["editor_a"]["can_manage"])
        self.assertFalse(rows["admin_a"]["can_manage"])  # themselves
        self.assertEqual(rows["editor_a"]["branch"], "alpha")
        self.assertEqual(rows["editor_a"]["role_label"], "Content Editor")
        self.assertNotIn("password", rows["editor_a"])

    def test_superusers_are_never_manageable_here(self):
        other = User.objects.create_superuser("other_boss", password="pw-Long-enough-1")
        self.client.force_authenticate(self.boss)
        row = self.client.get(detail(other.pk)).data
        self.assertFalse(row["can_manage"])
        self.assertEqual(self.client.patch(detail(other.pk), {"first_name": "X"}, format="json").status_code, 403)
        self.assertEqual(self.client.post(act(other.pk, "suspend")).status_code, 403)


class OtherRolesTests(PeopleTestCase):
    def test_finance_and_national_accounts_stay_in_the_django_admin(self):
        national = person("national", None, role="super_admin")
        self.client.force_authenticate(self.boss)
        for target in (self.treasurer_a, national):
            self.assertFalse(self.client.get(detail(target.pk)).data["can_manage"], target.username)
            response = self.client.patch(detail(target.pk), {"first_name": "X"}, format="json")
            self.assertEqual(response.status_code, 403, target.username)
            self.assertEqual(self.client.post(act(target.pk, "suspend")).status_code, 403)
        self.treasurer_a.refresh_from_db()
        self.assertEqual(self.treasurer_a.role, "finance_admin")


class AddTests(PeopleTestCase):
    def test_branch_admin_adds_a_content_editor_to_their_branch(self):
        self.client.force_authenticate(self.admin_a)
        response = self.client.post(LIST, self.new(branch="beta", role="branch_admin"), format="json")
        self.assertEqual(response.status_code, 201, response.data)
        newbie = User.objects.get(username="newbie")
        # Branch and role are theirs to give only within these limits.
        self.assertEqual(newbie.branch, self.alpha)
        self.assertEqual(newbie.role, "content_editor")
        self.assertTrue(newbie.is_staff)
        self.assertTrue(newbie.is_active)
        self.assertFalse(newbie.is_superuser)
        # They choose their own password from a link (Task 7.2); nobody else ever knows it.
        self.assertFalse(newbie.has_usable_password())
        self.assertEqual(list(newbie.groups.values_list("name", flat=True)), ["Content Editor"])

    def test_a_set_password_link_is_shown_once_and_works(self):
        from church_erp.accounts.password_links import usable_link
        self.client.force_authenticate(self.admin_a)
        response = self.client.post(LIST, self.new(), format="json")
        token = response.data["link_token"]
        self.assertNotIn("temporary_password", response.data)
        self.assertEqual(usable_link(token).user.username, "newbie")
        row = self.client.get(detail(response.data["id"])).data
        self.assertNotIn("link_token", row)

    def test_superuser_adds_a_branch_admin_anywhere(self):
        self.client.force_authenticate(self.boss)
        response = self.client.post(LIST, self.new(branch="beta", role="branch_admin"), format="json")
        self.assertEqual(response.status_code, 201, response.data)
        newbie = User.objects.get(username="newbie")
        self.assertEqual((newbie.branch, newbie.role), (self.beta, "branch_admin"))

    def test_superuser_must_choose_a_branch_and_an_allowed_role(self):
        self.client.force_authenticate(self.boss)
        self.assertEqual(self.client.post(LIST, self.new(role="content_editor"), format="json").status_code, 400)
        response = self.client.post(LIST, self.new(), format="json")
        self.assertEqual(response.status_code, 400)
        self.assertIn("role", response.data)
        for role in ("super_admin", "finance_admin", "pope"):
            response = self.client.post(LIST, self.new(branch="alpha", role=role), format="json")
            self.assertEqual(response.status_code, 400, role)
            self.assertIn("role", response.data)
        closed = make_branch("closed")
        closed.is_active = False
        closed.save()
        response = self.client.post(LIST, self.new(branch="closed", role="content_editor"), format="json")
        self.assertEqual(response.status_code, 400)
        self.assertFalse(User.objects.filter(username="newbie").exists())

    def test_nobody_becomes_a_superuser_here(self):
        self.client.force_authenticate(self.boss)
        response = self.client.post(
            LIST, self.new(branch="alpha", role="content_editor", is_superuser=True, is_staff=False), format="json",
        )
        newbie = User.objects.get(pk=response.data["id"])
        self.assertFalse(newbie.is_superuser)
        self.assertTrue(newbie.is_staff)

    def test_usernames_are_unique_whatever_their_capitals(self):
        self.client.force_authenticate(self.admin_a)
        response = self.client.post(LIST, self.new(username="Editor_A"), format="json")
        self.assertEqual(response.status_code, 400)
        self.assertIn("username", response.data)

    def test_usernames_and_emails_are_checked(self):
        self.client.force_authenticate(self.admin_a)
        for bad in ("has space", "", "x" * 151, "semi;colon"):
            response = self.client.post(LIST, self.new(username=bad), format="json")
            self.assertEqual(response.status_code, 400, bad)
        response = self.client.post(LIST, self.new(email="not an email"), format="json")
        self.assertEqual(response.status_code, 400)
        self.assertIn("email", response.data)

    def test_other_roles_cannot_add(self):
        self.client.force_authenticate(self.editor_a)
        self.assertEqual(self.client.post(LIST, self.new(), format="json").status_code, 403)


class ChangeTests(PeopleTestCase):
    def test_branch_admin_changes_their_editors_names_only(self):
        self.client.force_authenticate(self.admin_a)
        response = self.client.patch(
            detail(self.editor_a.pk),
            {"first_name": "Mercy", "email": "mercy@example.org", "role": "branch_admin", "branch": "beta", "username": "x"},
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.editor_a.refresh_from_db()
        self.assertEqual((self.editor_a.first_name, self.editor_a.email), ("Mercy", "mercy@example.org"))
        self.assertEqual((self.editor_a.role, self.editor_a.branch, self.editor_a.username), ("content_editor", self.alpha, "editor_a"))

    def test_branch_admin_cannot_change_other_admins_or_themselves(self):
        other_admin = person("admin_a2", self.alpha, role="branch_admin")
        self.client.force_authenticate(self.admin_a)
        for target in (other_admin, self.admin_a):
            self.assertEqual(self.client.patch(detail(target.pk), {"first_name": "X"}, format="json").status_code, 403)
            self.assertEqual(self.client.post(act(target.pk, "suspend")).status_code, 403)
            self.assertEqual(self.client.post(act(target.pk, "reset-password")).status_code, 403)

    def test_superuser_moves_people_between_branches_and_roles(self):
        self.client.force_authenticate(self.boss)
        response = self.client.patch(detail(self.editor_a.pk), {"role": "branch_admin", "branch": "beta"}, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        self.editor_a.refresh_from_db()
        self.assertEqual((self.editor_a.role, self.editor_a.branch), ("branch_admin", self.beta))
        self.assertEqual(list(self.editor_a.groups.values_list("name", flat=True)), ["Branch Admin"])
        response = self.client.patch(detail(self.editor_a.pk), {"role": "super_admin"}, format="json")
        self.assertEqual(response.status_code, 400)

    def test_superuser_cannot_change_themselves_here(self):
        self.client.force_authenticate(self.boss)
        self.assertEqual(self.client.patch(detail(self.boss.pk), {"first_name": "X"}, format="json").status_code, 403)

    def test_nobody_is_deleted(self):
        self.client.force_authenticate(self.boss)
        self.assertEqual(self.client.delete(detail(self.editor_a.pk)).status_code, 405)


class SuspendTests(PeopleTestCase):
    def signed_in(self, user):
        refresh = RefreshToken.for_user(user)
        return OutstandingToken.objects.get(jti=refresh["jti"])

    def test_suspending_signs_them_out_everywhere_and_restoring_lets_them_back(self):
        token = self.signed_in(self.editor_a)
        self.client.force_authenticate(self.admin_a)
        response = self.client.post(act(self.editor_a.pk, "suspend"))
        self.assertEqual(response.status_code, 200, response.data)
        self.editor_a.refresh_from_db()
        self.assertFalse(self.editor_a.is_active)
        self.assertTrue(BlacklistedToken.objects.filter(token=token).exists())
        self.assertFalse(response.data["is_active"])

        response = self.client.post(act(self.editor_a.pk, "restore"))
        self.assertEqual(response.status_code, 200)
        self.editor_a.refresh_from_db()
        self.assertTrue(self.editor_a.is_active)

    def test_a_suspended_account_cannot_use_the_api(self):
        self.client.force_authenticate(self.admin_a)
        self.client.post(act(self.editor_a.pk, "suspend"))
        access = str(RefreshToken.for_user(User.objects.get(pk=self.editor_a.pk)).access_token)
        self.client.force_authenticate(None)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
        self.assertEqual(self.client.get(reverse("staff-sermons-list", args=["alpha"])).status_code, 401)

    def test_branch_admin_cannot_suspend_other_branches(self):
        self.client.force_authenticate(self.admin_a)
        self.assertEqual(self.client.post(act(self.editor_b.pk, "suspend")).status_code, 404)
        self.editor_b.refresh_from_db()
        self.assertTrue(self.editor_b.is_active)

    def test_superuser_suspends_a_branch_admin(self):
        self.client.force_authenticate(self.boss)
        self.assertEqual(self.client.post(act(self.admin_b.pk, "suspend")).status_code, 200)
        self.admin_b.refresh_from_db()
        self.assertFalse(self.admin_b.is_active)


class ResetTests(PeopleTestCase):
    def test_password_reset_makes_a_new_link_stops_the_old_password_and_signs_them_out(self):
        from church_erp.accounts.password_links import usable_link
        token = OutstandingToken.objects.get(jti=RefreshToken.for_user(self.editor_a)["jti"])
        self.client.force_authenticate(self.admin_a)
        response = self.client.post(act(self.editor_a.pk, "reset-password"))
        self.assertEqual(response.status_code, 200, response.data)
        self.editor_a.refresh_from_db()
        self.assertEqual(usable_link(response.data["link_token"]).user, self.editor_a)
        self.assertFalse(self.editor_a.has_usable_password())
        self.assertTrue(BlacklistedToken.objects.filter(token=token).exists())
        actions = [c.action for c in StaffChange.objects.filter(target=self.editor_a.username)]
        self.assertEqual(actions.count("password reset"), 1)

    def test_two_step_reset_is_for_superusers(self):
        TOTPDevice.objects.create(user=self.admin_b, name="phone", confirmed=True)
        self.client.force_authenticate(self.admin_a)
        self.assertEqual(self.client.post(act(self.editor_a.pk, "reset-two-factor")).status_code, 403)
        self.client.force_authenticate(self.boss)
        response = self.client.post(act(self.admin_b.pk, "reset-two-factor"))
        self.assertEqual(response.status_code, 200)
        self.assertFalse(TOTPDevice.objects.filter(user=self.admin_b).exists())
        self.assertFalse(response.data["two_factor_enabled"])
