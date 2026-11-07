"""What the dashboard shows and changes for the AI drafts (AGENT_EXECUTION_PLAN.md, Task 4.5).

Staff turn drafts on per minister and describe how they write; drafts are
marked as written by AI, with the sermons they came from, and staff publish
them through the usual status box."""
from datetime import date

from django.core.cache import cache
from django.urls import reverse
from rest_framework.test import APITestCase

from church_erp.accounts.models import User
from church_erp.ai_messages.models import DailyMessage, SermonDocument
from church_erp.core.models import Minister
from church_erp.core.tests.helpers import make_branch


class AIDashboardTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.alpha = make_branch("alpha")
        cls.editor = User.objects.create_user("editor", password="pw", is_staff=True, branch=cls.alpha, role="content_editor")
        cls.minister = Minister.objects.create(branch=cls.alpha, name="Banda")

    def setUp(self):
        cache.clear()
        self.addCleanup(cache.clear)
        self.client.force_authenticate(self.editor)

    def test_staff_turn_drafts_on_and_write_style_notes(self):
        url = reverse("staff-ministers-detail", args=["alpha", self.minister.pk])
        response = self.client.patch(url, {"ai_drafts": True, "style_notes": "Short and warm."}, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        self.minister.refresh_from_db()
        self.assertTrue(self.minister.ai_drafts)
        self.assertEqual(self.minister.style_notes, "Short and warm.")
        too_long = self.client.patch(url, {"style_notes": "x" * 5001}, format="json")
        self.assertEqual(too_long.status_code, 400)

    def test_ai_drafts_say_so_and_name_their_sermons(self):
        document = SermonDocument.objects.create(minister=self.minister, title="The Good Shepherd", text="w")
        message = DailyMessage.objects.create(minister=self.minister, title="T", message="m", date=date(2026, 11, 9), ai_generated=True)
        message.source_documents.set([document])
        data = self.client.get(reverse("staff-messages-detail", args=["alpha", message.pk])).data
        self.assertTrue(data["ai_generated"])
        self.assertEqual(data["source_titles"], ["The Good Shepherd"])

    def test_staff_cant_mark_their_own_message_as_ai_or_change_its_sources(self):
        response = self.client.post(reverse("staff-messages-list", args=["alpha"]), {
            "minister": self.minister.pk, "title": "T", "message": "m", "date": "2026-11-09",
            "ai_generated": True, "source_titles": ["x"],
        }, format="json")
        self.assertEqual(response.status_code, 201)
        self.assertFalse(DailyMessage.objects.get().ai_generated)

    def test_publishing_an_ai_draft_records_who_and_when(self):
        message = DailyMessage.objects.create(minister=self.minister, title="T", message="m", date=date(2026, 11, 9), ai_generated=True)
        url = reverse("staff-messages-detail", args=["alpha", message.pk])
        self.assertEqual(self.client.patch(url, {"status": "published"}, format="json").status_code, 200)
        message.refresh_from_db()
        self.assertEqual((message.status, message.reviewed_by), ("published", self.editor))
        self.assertIsNotNone(message.published_at)

    def test_written_sermons_say_whether_their_minister_has_drafts_on(self):
        SermonDocument.objects.create(minister=self.minister, title="S", text="w")
        rows = self.client.get(reverse("staff-writings-list", args=["alpha"])).data["results"]
        self.assertFalse(rows[0]["minister_ai_drafts"])
