"""Role → staff access and permission group (AGENT_EXECUTION_PLAN.md, Task 0.2 follow-up)."""
from django.contrib.auth.models import Group
from django.core.management import call_command
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone

from church_erp.accounts.models import User
from church_erp.core.tests.helpers import make_branch, make_staff


def group_names(user):
    return set(user.groups.values_list("name", flat=True))


class RoleGroupSyncTests(TestCase):
    def setUp(self):
        call_command("setup_roles", verbosity=0)
        self.branch = make_branch("alpha")

    def test_new_user_joins_their_role_group(self):
        user = User.objects.create_user("ed", branch=self.branch, role="content_editor")
        self.assertEqual(group_names(user), {"Content Editor"})

    def test_changing_role_moves_the_user_between_groups(self):
        user = User.objects.create_user("ed", branch=self.branch, role="content_editor")
        user.role = "finance_admin"
        user.save()
        self.assertEqual(group_names(user), {"Finance Admin"})

    def test_groups_unrelated_to_roles_are_kept(self):
        choir = Group.objects.create(name="Choir")
        user = User.objects.create_user("ed", branch=self.branch, role="content_editor")
        user.groups.add(choir)
        user.role = "branch_admin"
        user.save()
        self.assertEqual(group_names(user), {"Choir", "Branch Admin"})

    def test_national_role_has_no_branch_group(self):
        user = User.objects.create_user("nat", role="super_admin")
        self.assertEqual(group_names(user), set())

    def test_explicit_is_staff_false_is_respected_outside_the_admin(self):
        user = User.objects.create_user("ed", role="content_editor", is_staff=False)
        self.assertFalse(user.is_staff)


class MissingGroupsTests(TestCase):
    def test_saving_users_before_setup_roles_does_not_fail(self):
        user = User.objects.create_user("early", role="content_editor")
        self.assertEqual(group_names(user), set())

    def test_setup_roles_assigns_groups_to_existing_users(self):
        user = User.objects.create_user("early", role="branch_admin")
        call_command("setup_roles", verbosity=0)
        self.assertEqual(group_names(user), {"Branch Admin"})


class AdminOnboardingTests(TestCase):
    def setUp(self):
        call_command("setup_roles", verbosity=0)
        self.branch = make_branch("alpha")

    def test_user_added_by_branch_admin_can_use_the_admin_immediately(self):
        branch_admin = User.objects.create_user(
            "badmin", password="pw", is_staff=True, branch=self.branch, role="branch_admin"
        )
        self.client.force_login(branch_admin)
        self.client.post(
            reverse("admin:accounts_user_add"),
            {
                "username": "newcomer",
                "password1": "a-Long-unique-pw-91",
                "password2": "a-Long-unique-pw-91",
                "usable_password": "true",
            },
        )
        newcomer = User.objects.get(username="newcomer")
        self.assertTrue(newcomer.is_staff)
        self.assertEqual(newcomer.branch, self.branch)
        self.assertEqual(group_names(newcomer), {"Content Editor"})

        self.client.force_login(newcomer)
        response = self.client.get(reverse("admin:content_sermon_changelist"))
        self.assertEqual(response.status_code, 200)

    def test_admin_form_cannot_drop_the_role_group(self):
        # The change form's groups field is saved after the user; the role group must survive it.
        root = User.objects.create_superuser("root", password="pw")
        editor = User.objects.create_user("ed", branch=self.branch, role="content_editor")
        self.client.force_login(root)
        now = timezone.localtime()
        self.client.post(
            reverse("admin:accounts_user_change", args=[editor.pk]),
            {
                "username": "ed",
                "first_name": "",
                "last_name": "",
                "email": "",
                "is_active": "on",
                "is_staff": "on",
                "date_joined_0": now.strftime("%Y-%m-%d"),
                "date_joined_1": now.strftime("%H:%M:%S"),
                "branch": self.branch.pk,
                "role": "branch_admin",
                # no "groups" → the form clears them
            },
        )
        self.assertEqual(group_names(editor), {"Branch Admin"})

    def test_superuser_can_still_revoke_staff_access(self):
        root = User.objects.create_superuser("root", password="pw")
        editor = make_staff("ed", self.branch, "content_editor")
        self.client.force_login(root)
        now = timezone.localtime()
        self.client.post(
            reverse("admin:accounts_user_change", args=[editor.pk]),
            {
                "username": "ed",
                "is_active": "on",
                "date_joined_0": now.strftime("%Y-%m-%d"),
                "date_joined_1": now.strftime("%H:%M:%S"),
                "branch": self.branch.pk,
                "role": "content_editor",
            },
        )
        editor.refresh_from_db()
        self.assertFalse(editor.is_staff)
