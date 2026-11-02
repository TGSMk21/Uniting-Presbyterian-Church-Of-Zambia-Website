"""The setup_roles command (AGENT_EXECUTION_PLAN.md, Task 0.2)."""
from django.contrib.auth.models import Group
from django.core.management import call_command
from django.test import TestCase
from django.urls import reverse

from church_erp.accounts.models import User

from .helpers import make_branch


def perms(group_name):
    group = Group.objects.get(name=group_name)
    return {
        f"{p.content_type.app_label}.{p.codename}" for p in group.permissions.all()
    }


class SetupRolesTests(TestCase):
    def setUp(self):
        call_command("setup_roles", verbosity=0)

    def test_content_editor_can_manage_content_but_not_finance_or_users(self):
        granted = perms("Content Editor")
        self.assertIn("content.change_sermon", granted)
        self.assertIn("media_library.add_mediaasset", granted)
        self.assertIn("ai_messages.change_dailymessage", granted)
        self.assertNotIn("finance.view_givingrecord", granted)
        self.assertNotIn("accounts.change_user", granted)
        self.assertNotIn("core.change_branch", granted)

    def test_branch_admin_can_also_manage_branch_ministers_and_users(self):
        granted = perms("Branch Admin")
        self.assertTrue(perms("Content Editor") <= granted)
        self.assertIn("core.change_branch", granted)
        self.assertIn("core.add_minister", granted)
        self.assertIn("accounts.add_user", granted)
        self.assertNotIn("core.add_branch", granted)
        self.assertNotIn("finance.view_givingrecord", granted)

    def test_finance_admin_can_record_but_not_delete_giving(self):
        granted = perms("Finance Admin")
        self.assertIn("finance.add_givingrecord", granted)
        self.assertNotIn("finance.delete_givingrecord", granted)
        self.assertNotIn("content.change_sermon", granted)

    def test_rerunning_resets_groups_without_duplicates(self):
        Group.objects.get(name="Content Editor").permissions.clear()
        call_command("setup_roles", verbosity=0)
        self.assertEqual(Group.objects.filter(name="Content Editor").count(), 1)
        self.assertIn("content.change_sermon", perms("Content Editor"))

    def test_group_member_can_use_the_admin(self):
        branch = make_branch("alpha")
        editor = User.objects.create_user(
            "editor", is_staff=True, branch=branch, role="content_editor"
        )
        editor.groups.add(Group.objects.get(name="Content Editor"))
        self.client.force_login(editor)
        self.assertEqual(
            self.client.get(reverse("admin:content_sermon_changelist")).status_code, 200
        )
