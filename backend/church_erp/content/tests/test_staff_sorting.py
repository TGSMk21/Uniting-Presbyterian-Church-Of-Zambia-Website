"""Sorting the dashboard's long lists (AGENT_EXECUTION_PLAN.md, Task 7.3).

Each list allows a few sorts with ?ordering=; anything else is ignored and
the usual order (newest first) stays."""
from datetime import date, timedelta

from django.core.cache import cache
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase

from church_erp.accounts.models import User
from church_erp.ai_messages.models import SermonDocument
from church_erp.content.models import Activity, Project, Sermon
from church_erp.core.models import Minister
from church_erp.core.tests.helpers import make_branch


class SortingTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.alpha = make_branch("alpha")
        cls.editor = User.objects.create_user("editor", password="pw", is_staff=True, branch=cls.alpha, role="content_editor")
        now = timezone.now()
        Sermon.objects.create(branch=cls.alpha, title="Banana", video_id="v1", preached_at=now - timedelta(days=2))
        Sermon.objects.create(branch=cls.alpha, title="Apple", video_id="v2", preached_at=now - timedelta(days=1))
        Sermon.objects.create(branch=cls.alpha, title="Cherry", video_id="v3", preached_at=now - timedelta(days=3))
        for title, day in (("Zeta", 5), ("Alpha", 1)):
            Activity.objects.create(branch=cls.alpha, title=title, date=date(2026, 12, day), start_time="09:00",
                                    end_time="10:00", location="Hall", details="d")
        Project.objects.create(branch=cls.alpha, title="Roof", description="d", start_date=date(2026, 1, 1))
        minister = Minister.objects.create(branch=cls.alpha, name="Banda")
        SermonDocument.objects.create(minister=minister, title="Zebra", text="a")
        SermonDocument.objects.create(minister=minister, title="Ant", text="b")

    def setUp(self):
        cache.clear()
        self.addCleanup(cache.clear)
        self.client.force_authenticate(self.editor)

    def titles(self, section, query=""):
        url = reverse(f"staff-{section}-list", args=["alpha"]) + query
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200, response.data)
        return [row["title"] for row in response.data["results"]]

    def test_lists_are_newest_first_by_default(self):
        self.assertEqual(self.titles("sermons"), ["Apple", "Banana", "Cherry"])

    def test_allowed_sorts(self):
        self.assertEqual(self.titles("sermons", "?ordering=title"), ["Apple", "Banana", "Cherry"])
        self.assertEqual(self.titles("sermons", "?ordering=preached_at"), ["Cherry", "Banana", "Apple"])
        self.assertEqual(self.titles("activities", "?ordering=date"), ["Alpha", "Zeta"])
        self.assertEqual(self.titles("writings", "?ordering=title"), ["Ant", "Zebra"])

    def test_other_fields_are_ignored(self):
        # The full words of a written sermon aren't something to sort by.
        self.assertEqual(self.titles("writings", "?ordering=text"), self.titles("writings"))
        self.assertEqual(self.titles("sermons", "?ordering=description"), ["Apple", "Banana", "Cherry"])
