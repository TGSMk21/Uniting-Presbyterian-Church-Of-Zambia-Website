"""Lean public address for the app's events screen: GET /api/app/events/?branch=<slug>&limit=
(MOBILE_APP_PLAN.md, Phase 4). Upcoming and past events, most recent first, with photos."""
from datetime import date, time, timedelta

from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase

from church_erp.content.models import Activity, ActivityPhoto
from church_erp.core.tests.helpers import make_branch

URL = reverse("app-events")


def make_activity(branch, title, day, start=time(9)):
    return Activity.objects.create(
        branch=branch, title=title, date=day, start_time=start, end_time=time(11),
        details=f"Details of {title}.", location="Main Hall",
    )


class AppEventsTests(APITestCase):
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

    def test_most_recent_first_with_details_location_times_and_photos(self):
        old = make_activity(self.branch, "Last month", self.today - timedelta(days=30))
        soon = make_activity(self.branch, "Next Sunday", self.today + timedelta(days=6), start=time(10))
        today_ev = make_activity(self.branch, "Today", self.today, start=time(14))
        make_activity(self.other, "Elsewhere", self.today)
        photo = ActivityPhoto.objects.create(
            activity=old, image=SimpleUploadedFile("p.png", b"\x89PNG\r\n\x1a\n", content_type="image/png"),
        )
        data = self.client.get(URL, {"branch": "chilanga"}).data
        self.assertEqual(data["branch"], {"slug": "chilanga", "name": "Chilanga"})
        rows = data["events"]
        self.assertEqual([r["title"] for r in rows], ["Next Sunday", "Today", "Last month"])
        row = rows[1]
        self.assertEqual(set(row), {"id", "title", "date", "start_time", "end_time", "location", "details", "photos"})
        self.assertEqual(row["location"], "Main Hall")
        self.assertEqual(row["details"], "Details of Today.")
        last = rows[2]
        self.assertEqual(last["photos"], [{"id": photo.pk, "url": photo.image.url}])
        self.assertEqual(rows[0]["photos"], [])

    def test_limit_is_capped(self):
        for i in range(250):
            make_activity(self.branch, f"E{i:03d}", self.today - timedelta(days=i))
        self.assertEqual(len(self.client.get(URL, {"branch": "chilanga"}).data["events"]), 100)
        self.assertEqual(len(self.client.get(URL, {"branch": "chilanga", "limit": "999"}).data["events"]), 200)
        self.assertEqual(len(self.client.get(URL, {"branch": "chilanga", "limit": "junk"}).data["events"]), 100)
