"""What needs attention, for the dashboard's Overview (AGENT_EXECUTION_PLAN.md, Task 7.3).

Counts only for what the person may see: their own branch, or every branch
for superusers. Access requests follow the same rule as the Requests page,
and recent changes are for superusers, like the change history."""
from datetime import timedelta

from django.core.cache import cache
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase

from church_erp.accounts.models import AccessRequest, User
from church_erp.ai_messages.models import DailyMessage, SermonDocument, SermonEmbedding
from church_erp.core.changes import record
from church_erp.core.models import Minister
from church_erp.core.tests.helpers import make_branch

URL = reverse("staff-overview")


class OverviewTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.alpha = make_branch("alpha")
        cls.beta = make_branch("beta")
        cls.boss = User.objects.create_superuser("boss", password="pw")
        cls.minister_a = User.objects.create_user("rev_a", password="pw", is_staff=True, branch=cls.alpha, role="branch_admin")
        cls.editor_a = User.objects.create_user("editor_a", password="pw", is_staff=True, branch=cls.alpha, role="content_editor")
        cls.finance = User.objects.create_user("money", password="pw", is_staff=True, branch=cls.alpha, role="finance_admin")
        cls.banda = Minister.objects.create(branch=cls.alpha, name="Banda", ai_drafts=True)
        cls.phiri = Minister.objects.create(branch=cls.beta, name="Phiri", ai_drafts=True)
        today = timezone.localdate()
        cls.tomorrow = today + timedelta(days=1)
        # Alpha: two AI drafts waiting (one for an old day, which doesn't count), one plain draft.
        DailyMessage.objects.create(minister=cls.banda, title="A", message="m", date=cls.tomorrow, ai_generated=True)
        DailyMessage.objects.create(minister=cls.banda, title="B", message="m", date=today, ai_generated=True)
        DailyMessage.objects.create(minister=cls.banda, title="Old", message="m", date=today - timedelta(days=3), ai_generated=True)
        DailyMessage.objects.create(minister=cls.banda, title="C", message="m", date=cls.tomorrow + timedelta(days=1))
        # Beta: tomorrow is already published.
        DailyMessage.objects.create(minister=cls.phiri, title="P", message="m", date=cls.tomorrow, status="published")
        # Sermons: one of Alpha's read, one waiting; Beta's waiting.
        read = SermonDocument.objects.create(minister=cls.banda, title="Read", text="w")
        SermonEmbedding.objects.create(document=read, chunk_index=0, chunk_text="w", embedding=[0.1] * 1536, model="gemini-embedding-001")
        SermonDocument.objects.create(minister=cls.banda, title="Waiting", text="w")
        SermonDocument.objects.create(minister=cls.phiri, title="Beta waiting", text="w")
        # A minister with AI drafts off: their sermons are never read, so they don't count as waiting.
        off = Minister.objects.create(branch=cls.alpha, name="Mwale", ai_drafts=False)
        SermonDocument.objects.create(minister=off, title="Never read", text="w")
        AccessRequest.objects.create(full_name="S", email="s@example.org", phone="0971234567", branch=cls.alpha, kind="staff")
        AccessRequest.objects.create(full_name="M", email="m@example.org", phone="0971234567", branch=cls.alpha, kind="minister")
        AccessRequest.objects.create(full_name="B", email="b@example.org", phone="0971234567", branch=cls.beta, kind="staff")
        record(cls.minister_a, "pages", "changed", branch=cls.alpha, target="home")

    def setUp(self):
        cache.clear()
        self.addCleanup(cache.clear)

    def overview(self, user):
        self.client.force_authenticate(user)
        response = self.client.get(URL)
        self.assertEqual(response.status_code, 200, getattr(response, "data", None))
        return response.data

    def test_a_branchs_staff_see_their_own_branch_only(self):
        data = self.overview(self.editor_a)
        self.assertEqual([b["slug"] for b in data["branches"]], ["alpha"])
        alpha = data["branches"][0]
        self.assertEqual(alpha["ai_drafts"], 2)
        self.assertEqual(alpha["drafts"], 3)
        self.assertFalse(alpha["tomorrow_published"])
        self.assertEqual(alpha["sermons_waiting"], 1)
        self.assertEqual(data["tomorrow"], self.tomorrow.isoformat())
        # Content editors don't review requests or read the history.
        self.assertIsNone(data["requests_waiting"])
        self.assertIsNone(data["recent_changes"])

    def test_a_ministers_account_sees_its_branchs_staff_requests(self):
        data = self.overview(self.minister_a)
        self.assertEqual(data["requests_waiting"], 1)

    def test_superusers_see_every_branch_requests_and_recent_changes(self):
        data = self.overview(self.boss)
        by_slug = {b["slug"]: b for b in data["branches"]}
        self.assertEqual(set(by_slug), {"alpha", "beta"})
        self.assertTrue(by_slug["beta"]["tomorrow_published"])
        self.assertEqual(by_slug["beta"]["sermons_waiting"], 1)
        self.assertEqual(data["requests_waiting"], 3)
        self.assertEqual([(c["username"], c["section"], c["target"]) for c in data["recent_changes"]], [("rev_a", "pages", "home")])

    def test_branches_taken_off_the_website_are_left_out(self):
        self.beta.is_active = False
        self.beta.save()
        self.assertEqual([b["slug"] for b in self.overview(self.boss)["branches"]], ["alpha"])

    def test_people_without_branch_content_get_nothing_to_do(self):
        data = self.overview(self.finance)
        self.assertEqual(data["branches"], [])
        self.assertIsNone(data["requests_waiting"])

    def test_signed_out_people_are_refused(self):
        self.assertEqual(self.client.get(URL).status_code, 401)

    def test_the_counts_take_a_fixed_number_of_queries(self):
        from django.db import connection
        from django.test.utils import CaptureQueriesContext
        self.client.force_authenticate(self.boss)
        with CaptureQueriesContext(connection) as before:
            self.client.get(URL)
        for number in range(5):
            make_branch(f"extra{number}")
        with CaptureQueriesContext(connection) as after:
            self.client.get(URL)
        self.assertEqual(len(after), len(before))
