"""General announcements on each branch's home page (owner's request, 2026-11-08).

Staff add them at /api/staff/<branch>/announcements/. The public address shows
only those whose dates are current, pinned ones first, so old notices drop off
by themselves."""
from datetime import timedelta

from django.core.cache import cache
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase

from church_erp.accounts.models import User
from church_erp.content.models import Announcement
from church_erp.core.models import StaffChange
from church_erp.core.tests.helpers import make_branch

PUBLIC = reverse("announcement-list")


def staff_list(scope):
    return reverse("staff-announcements-list", args=[scope])


class AnnouncementTestCase(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.alpha = make_branch("alpha")
        cls.beta = make_branch("beta")
        cls.editor = User.objects.create_user("editor", password="pw", is_staff=True, branch=cls.alpha, role="content_editor")
        cls.today = timezone.localdate()

    def setUp(self):
        cache.clear()
        self.addCleanup(cache.clear)

    def make(self, branch=None, **extra):
        values = {"title": "Notice", "body": "Words.", "starts_on": self.today, **extra}
        return Announcement.objects.create(branch=branch or self.alpha, **values)


class PublicTests(AnnouncementTestCase):
    def titles(self, query="?branch=alpha"):
        return [row["title"] for row in self.client.get(PUBLIC + query).data["results"]]

    def test_only_current_announcements_show_pinned_first_then_newest(self):
        self.make(title="Older", starts_on=self.today - timedelta(days=5))
        self.make(title="Newer", starts_on=self.today - timedelta(days=1))
        self.make(title="Pinned", starts_on=self.today - timedelta(days=10), is_pinned=True)
        self.make(title="Ends today", starts_on=self.today - timedelta(days=3), ends_on=self.today)
        self.make(title="Not yet", starts_on=self.today + timedelta(days=1))
        self.make(title="Over", starts_on=self.today - timedelta(days=9), ends_on=self.today - timedelta(days=1))
        self.assertEqual(self.titles(), ["Pinned", "Newer", "Ends today", "Older"])

    def test_each_branch_sees_its_own(self):
        self.make(title="Alpha's")
        self.make(branch=self.beta, title="Beta's")
        self.assertEqual(self.titles("?branch=beta"), ["Beta's"])

    def test_branches_taken_off_the_website_show_nothing(self):
        self.make()
        self.alpha.is_active = False
        self.alpha.save()
        self.assertEqual(self.titles(), [])

    def test_the_public_address_is_read_only(self):
        self.client.force_authenticate(self.editor)
        response = self.client.post(PUBLIC, {"title": "x"}, format="json")
        self.assertEqual(response.status_code, 405)


class StaffTests(AnnouncementTestCase):
    def setUp(self):
        super().setUp()
        self.client.force_authenticate(self.editor)

    def test_staff_add_one_for_their_branch_and_it_is_recorded(self):
        response = self.client.post(staff_list("alpha"), {
            "title": "Harvest Sunday", "body": "Bring your offerings.\n\nAll welcome.",
            "starts_on": self.today.isoformat(), "ends_on": (self.today + timedelta(days=7)).isoformat(), "is_pinned": True,
        }, format="json")
        self.assertEqual(response.status_code, 201, response.data)
        notice = Announcement.objects.get()
        self.assertEqual((notice.branch, notice.is_pinned), (self.alpha, True))
        self.assertTrue(StaffChange.objects.filter(section="announcements", action="added").exists())

    def test_the_end_cant_be_before_the_start_and_text_has_limits(self):
        bad = [
            {"ends_on": (self.today - timedelta(days=1)).isoformat()},
            {"title": "x" * 201},
            {"body": "x" * 2001},
            {"title": ""},
        ]
        for extra in bad:
            with self.subTest(extra=list(extra)):
                values = {"title": "T", "body": "B", "starts_on": self.today.isoformat(), **extra}
                self.assertEqual(self.client.post(staff_list("alpha"), values, format="json").status_code, 400)
        self.assertFalse(Announcement.objects.exists())

    def test_other_branches_are_refused(self):
        self.assertEqual(self.client.get(staff_list("beta")).status_code, 403)

    def test_staff_see_past_and_future_ones_too(self):
        self.make(title="Over", starts_on=self.today - timedelta(days=9), ends_on=self.today - timedelta(days=1))
        self.make(title="Not yet", starts_on=self.today + timedelta(days=1))
        titles = {row["title"] for row in self.client.get(staff_list("alpha")).data["results"]}
        self.assertEqual(titles, {"Over", "Not yet"})
