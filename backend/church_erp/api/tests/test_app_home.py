"""The mobile app's one lean home address: /api/app/home/?branch=<slug> (MOBILE_APP_PLAN.md, Phase 2).

Public, read-only, one request returning today's verse, the daily message, anything
live, the latest sermons and the upcoming events of one branch."""
from datetime import time, timedelta

from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase

from church_erp.ai_messages.models import DailyMessage
from church_erp.content.models import Activity, PageContent, Sermon
from church_erp.core.models import Branch, Minister
from church_erp.core.tests.helpers import make_branch

URL = reverse("app-home")


def make_minister(branch, name="Rev Test"):
    return Minister.objects.create(branch=branch, name=name)


def make_message(minister, day, status="published", title="Today's word", verse="In the beginning", ref="Genesis 1:1"):
    return DailyMessage.objects.create(
        minister=minister, title=title, message="A short devotion.", reference_verse=ref,
        verse_text=verse, date=day, status=status, published_at=timezone.now() if status == "published" else None,
    )


def make_sermon(branch, title, when, **kwargs):
    return Sermon.objects.create(
        branch=branch, title=title, video_id=f"vid-{title}", preached_at=when, **kwargs,
    )


def make_activity(branch, title, day, start=time(9)):
    return Activity.objects.create(
        branch=branch, title=title, date=day, start_time=start, end_time=time(10),
        details="d", location="Hall",
    )


class AppHomeTests(APITestCase):
    def setUp(self):
        self.branch = make_branch("chilanga")
        self.other = make_branch("kanyama")
        self.today = timezone.localdate()

    def get(self, **params):
        return self.client.get(URL, params)

    def test_requires_a_branch(self):
        response = self.get()
        self.assertEqual(response.status_code, 400)
        self.assertEqual(self.get(branch="").status_code, 400)

    def test_unknown_or_inactive_branch_is_not_found(self):
        self.assertEqual(self.get(branch="nowhere").status_code, 404)
        self.branch.is_active = False
        self.branch.save()
        self.assertEqual(self.get(branch="chilanga").status_code, 404)

    def test_anyone_can_read_it_anonymously(self):
        response = self.get(branch="chilanga")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["branch"], {"slug": "chilanga", "name": "Chilanga"})
        self.assertEqual(response.json()["date"], self.today.isoformat())

    def test_a_branch_with_nothing_published_gets_nulls_and_empty_lists(self):
        data = self.get(branch="chilanga").data
        self.assertIsNone(data["daily_message"])
        self.assertIsNone(data["verse"])
        self.assertIsNone(data["live"])
        self.assertEqual(data["sermons"], [])
        self.assertEqual(data["events"], [])

    def test_todays_published_message_is_returned(self):
        minister = make_minister(self.branch)
        make_message(minister, self.today, title="Grace upon grace")
        data = self.get(branch="chilanga").data
        self.assertEqual(data["daily_message"]["title"], "Grace upon grace")
        self.assertEqual(data["daily_message"]["message"], "A short devotion.")
        self.assertEqual(data["verse"], {"text": "In the beginning", "ref": "Genesis 1:1"})

    def test_only_published_messages_not_yet_due_are_visible(self):
        minister = make_minister(self.branch)
        make_message(minister, self.today, status="pending_review", title="Draft")
        make_message(minister, self.today, status="rejected", title="Rejected")
        make_message(minister, self.today + timedelta(days=1), status="published", title="Future")
        data = self.get(branch="chilanga").data
        self.assertIsNone(data["daily_message"])

    def test_when_nothing_is_published_today_the_latest_past_message_is_used(self):
        minister = make_minister(self.branch)
        make_message(minister, self.today - timedelta(days=2), title="Older")
        make_message(minister, self.today - timedelta(days=1), title="Newer past")
        self.assertEqual(self.get(branch="chilanga").data["daily_message"]["title"], "Newer past")

    def test_another_branch_message_is_never_shown(self):
        make_message(make_minister(self.other), self.today, title="Kanyama only")
        self.assertIsNone(self.get(branch="chilanga").data["daily_message"])

    def test_the_verse_falls_back_to_the_branch_home_page_wording(self):
        minister = make_minister(self.branch)
        make_message(minister, self.today, verse="", ref="")
        PageContent.objects.create(
            branch=self.branch, page="home",
            fields={"verse_text": "The Lord is my shepherd", "verse_ref": "Psalm 23:1"},
        )
        self.assertEqual(
            self.get(branch="chilanga").data["verse"],
            {"text": "The Lord is my shepherd", "ref": "Psalm 23:1"},
        )

    def test_a_live_sermon_is_reported_and_hidden_or_dead_ones_are_not(self):
        make_sermon(self.branch, "Normal", timezone.now() - timedelta(hours=5))
        live = make_sermon(self.branch, "Live now", timezone.now(), is_live=True)
        make_sermon(self.branch, "Live but hidden", timezone.now(), is_live=True, is_hidden=True)
        make_sermon(self.other, "Other branch live", timezone.now(), is_live=True)
        data = self.get(branch="chilanga").data
        self.assertEqual(data["live"]["title"], "Live now")
        self.assertEqual(data["live"]["video_id"], live.video_id)

    def test_latest_sermons_newest_first_at_most_five_hidden_and_other_branches_left_out(self):
        for i in range(7):
            make_sermon(self.branch, f"S{i}", timezone.now() - timedelta(hours=i))
        make_sermon(self.branch, "Hidden", timezone.now(), is_hidden=True)
        make_sermon(self.other, "Elsewhere", timezone.now())
        rows = self.get(branch="chilanga").data["sermons"]
        self.assertEqual(len(rows), 5)
        self.assertEqual(rows[0]["title"], "S0")
        self.assertEqual(rows[-1]["title"], "S4")
        self.assertNotIn("Hidden", [r["title"] for r in rows])
        for row in rows:
            self.assertEqual(set(row), {"video_id", "title", "reference_verse", "preached_at", "duration"})

    def test_upcoming_events_soonest_first_at_most_five(self):
        make_activity(self.branch, "Yesterday", self.today - timedelta(days=1))
        make_activity(self.branch, "Today", self.today, start=time(14))
        make_activity(self.branch, "Today early", self.today, start=time(8))
        make_activity(self.branch, "Next week", self.today + timedelta(days=7))
        make_activity(self.other, "Other branch", self.today)
        rows = self.get(branch="chilanga").data["events"]
        self.assertEqual([r["title"] for r in rows], ["Today early", "Today", "Next week"])
        self.assertEqual(rows[0]["location"], "Hall")
        self.assertIn("start_time", rows[0])

    def test_more_than_five_upcoming_events_are_cut_off(self):
        for i in range(8):
            make_activity(self.branch, f"E{i}", self.today + timedelta(days=i))
        self.assertEqual(len(self.get(branch="chilanga").data["events"]), 5)
