"""The admin's record of who changed what (AGENT_EXECUTION_PLAN.md, Phase 6)."""
from django.contrib.admin.models import ADDITION, DELETION, LogEntry
from django.contrib.contenttypes.models import ContentType
from django.test import TestCase
from django.urls import reverse

from church_erp.accounts.models import User
from church_erp.core.models import Branch
from church_erp.core.tests.helpers import make_branch


class ActivityLogTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.branch = make_branch("alpha")
        cls.superuser = User.objects.create_superuser("root", password="pw")
        cls.branch_admin = User.objects.create_user(
            "manager", password="pw", is_staff=True, branch=cls.branch, role="branch_admin"
        )
        cls.entry = LogEntry.objects.create(
            user=cls.branch_admin,
            content_type=ContentType.objects.get_for_model(Branch),
            object_id=str(cls.branch.pk),
            object_repr="Alpha branch",
            action_flag=ADDITION,
            change_message="Added.",
        )
        cls.list_url = reverse("admin:admin_logentry_changelist")
        cls.detail_url = reverse("admin:admin_logentry_change", args=[cls.entry.pk])

    def test_superuser_sees_who_did_what(self):
        self.client.force_login(self.superuser)
        response = self.client.get(self.list_url)
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "manager")
        self.assertContains(response, "Alpha branch")

    def test_superuser_can_open_an_entry_but_not_save_it(self):
        self.client.force_login(self.superuser)
        self.assertEqual(self.client.get(self.detail_url).status_code, 200)
        response = self.client.post(self.detail_url, {"object_repr": "Rewritten"})
        self.assertEqual(response.status_code, 403)
        self.entry.refresh_from_db()
        self.assertEqual(self.entry.object_repr, "Alpha branch")

    def test_the_log_cannot_be_added_to_or_deleted_from(self):
        self.client.force_login(self.superuser)
        self.assertEqual(self.client.get(reverse("admin:admin_logentry_add")).status_code, 403)
        delete_url = reverse("admin:admin_logentry_delete", args=[self.entry.pk])
        self.assertEqual(self.client.post(delete_url, {"post": "yes"}).status_code, 403)
        response = self.client.post(self.list_url, {
            "action": "delete_selected", "_selected_action": [self.entry.pk], "post": "yes",
        })
        self.assertTrue(LogEntry.objects.filter(pk=self.entry.pk).exists(), response.status_code)

    def test_branch_staff_cannot_see_it(self):
        self.client.force_login(self.branch_admin)
        self.assertEqual(self.client.get(self.list_url).status_code, 403)
        self.assertEqual(self.client.get(self.detail_url).status_code, 403)

    def test_real_admin_edits_land_in_the_log(self):
        self.client.force_login(self.superuser)
        doomed = make_branch("doomed")
        response = self.client.post(
            reverse("admin:core_branch_delete", args=[doomed.pk]), {"post": "yes"}
        )
        self.assertEqual(response.status_code, 302)
        self.assertFalse(Branch.objects.filter(pk=doomed.pk).exists())
        entry = LogEntry.objects.exclude(pk=self.entry.pk).get()
        self.assertEqual(entry.user, self.superuser)
        self.assertEqual(entry.action_flag, DELETION)
        self.assertEqual(entry.object_id, str(doomed.pk))
