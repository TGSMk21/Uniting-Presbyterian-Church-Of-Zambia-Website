"""Lean public address for the app's announcements screen: GET /api/app/announcements/?branch=<slug>
(MOBILE_APP_PLAN.md, Phase 5). Current announcements only, pinned first."""
from datetime import timedelta

from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase

from church_erp.content.models import Announcement
from church_erp.core.tests.helpers import make_branch

URL = reverse("app-announcements")


def make_announcement(branch, title, starts_on, ends_on=None, is_pinned=False, body="Body"):
    return Announcement.objects.create(
        branch=branch, title=title, body=body, starts_on=starts_on, ends_on=ends_on, is_pinned=is_pinned,
    )


class AppAnnouncementsTests(APITestCase):
    def setUp(self):
        self.branch = make_branch("chilanga")
        self.other = make_branch("kanyama")
        self.today = timezone.localdate()

    def test_requires_a_branch_and_a_known_active_one(self):
        self.assertEqual(self.client.get(URL).status_code, 400)
        self.assertEqual(self.client.get(URL, {"branch": "nowhere"}).status_code, 404)
        self.branch.is_active = False
        self.branch.save()
        self.assertEqual(self.client.get(URL, {"branch": "chilanga"}).status_code, 404)

    def test_current_announcements_only_pinned_first_lean_fields_other_branches_excluded(self):
        make_announcement(self.branch, "Old news", self.today - timedelta(days=10), ends_on=self.today - timedelta(days=1))
        make_announcement(self.branch, "Not yet", self.today + timedelta(days=3))
        make_announcement(self.branch, "Plain", self.today - timedelta(days=2), body="Plain body")
        make_announcement(self.branch, "Pinned", self.today - timedelta(days=1), is_pinned=True, body="Pinned body")
        make_announcement(self.other, "Elsewhere", self.today)
        data = self.client.get(URL, {"branch": "chilanga"}).data
        self.assertEqual(data["branch"], {"slug": "chilanga", "name": "Chilanga"})
        rows = data["announcements"]
        self.assertEqual([r["title"] for r in rows], ["Pinned", "Plain"])
        self.assertEqual(set(rows[0]), {"id", "title", "body", "starts_on", "is_pinned"})
        self.assertTrue(rows[0]["is_pinned"])
        self.assertEqual(rows[0]["body"], "Pinned body")
