"""DailyMessage.verse_text: the day's scripture, separate from the devotion."""
from django.urls import reverse
from rest_framework.test import APITestCase

from church_erp.accounts.models import User
from church_erp.ai_messages.models import DailyMessage
from church_erp.core.models import Minister
from church_erp.core.tests.helpers import make_branch


class VerseTextTests(APITestCase):
    def setUp(self):
        self.branch = make_branch("alpha")
        self.minister = Minister.objects.create(branch=self.branch, name="Rev A")

    def test_public_api_returns_the_verse_with_its_reference(self):
        DailyMessage.objects.create(
            minister=self.minister, title="Light", message="Devotion body",
            reference_verse="Psalm 119:105", verse_text="Your word is a lamp to my feet.",
            date="2026-11-02", status="published",
        )
        row = self.client.get(reverse("dailymessage-list"), {"branch": "alpha"}).data["results"][0]
        self.assertEqual(row["verse_text"], "Your word is a lamp to my feet.")
        self.assertEqual(row["reference_verse"], "Psalm 119:105")
        self.assertEqual(row["message"], "Devotion body")
        self.assertEqual(row["minister_name"], "Rev A")

    def test_verse_is_optional(self):
        staff = User.objects.create_user("ed", is_staff=True, branch=self.branch)
        self.client.force_authenticate(staff)
        response = self.client.post(
            reverse("dailymessage-list"),
            {"minister": self.minister.pk, "title": "T", "message": "m", "date": "2026-11-03"},
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["verse_text"], "")
