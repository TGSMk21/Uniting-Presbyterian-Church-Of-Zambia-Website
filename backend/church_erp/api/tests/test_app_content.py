"""Lean public addresses for the app's sermons and daily-message library (MOBILE_APP_PLAN.md, Phase 3):

GET /api/app/sermons/?branch=<slug>&limit=   newest first, hidden excluded
GET /api/app/messages/?branch=<slug>&q=&limit=  published, not yet due, newest first, optional title search
GET /api/app/messages/<id>/?branch=<slug>    one full message, only if it belongs to the branch and is public
"""
from datetime import timedelta

from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase

from church_erp.ai_messages.models import DailyMessage
from church_erp.content.models import Sermon
from church_erp.core.models import Minister
from church_erp.core.tests.helpers import make_branch

SERMONS_URL = reverse("app-sermons")
MESSAGES_URL = reverse("app-messages")


def detail_url(pk):
    return reverse("app-message-detail", args=[pk])


def make_minister(branch, name="Rev Test"):
    return Minister.objects.create(branch=branch, name=name)


def make_sermon(branch, title, when, **kwargs):
    minister = kwargs.pop("minister", None) or make_minister(branch)
    return Sermon.objects.create(
        branch=branch, minister=minister, title=title, video_id=f"vid-{title}",
        preached_at=when, **kwargs,
    )


def make_message(minister, day, title="Today's word", status="published", reference_verse="John 3:16"):
    return DailyMessage.objects.create(
        minister=minister, title=title, message=f"Body of {title}.", reference_verse=reference_verse,
        verse_text="For God so loved the world", date=day, status=status,
        published_at=timezone.now() if status == "published" else None,
    )


class AppSermonsTests(APITestCase):
    def setUp(self):
        self.branch = make_branch("chilanga")
        self.other = make_branch("kanyama")
        self.today = timezone.localdate()

    def test_requires_a_branch_and_a_known_active_one(self):
        self.assertEqual(self.client.get(SERMONS_URL).status_code, 400)
        self.assertEqual(self.client.get(SERMONS_URL, {"branch": "nowhere"}).status_code, 404)
        self.branch.is_active = False
        self.branch.save()
        self.assertEqual(self.client.get(SERMONS_URL, {"branch": "chilanga"}).status_code, 404)

    def test_newest_first_lean_fields_hidden_and_other_branches_excluded(self):
        now = timezone.now()
        make_sermon(self.branch, "Old", now - timedelta(days=3))
        make_sermon(self.branch, "New", now - timedelta(hours=1), reference_verse="Psalm 23", duration="PT31M", is_live=True)
        make_sermon(self.branch, "Hidden", now, is_hidden=True)
        make_sermon(self.other, "Elsewhere", now)
        data = self.client.get(SERMONS_URL, {"branch": "chilanga"}).data
        self.assertEqual(data["branch"], {"slug": "chilanga", "name": "Chilanga"})
        rows = data["sermons"]
        self.assertEqual([r["title"] for r in rows], ["New", "Old"])
        self.assertEqual(set(rows[0]), {
            "id", "video_id", "title", "reference_verse", "preached_at", "duration", "is_live", "minister_name",
        })
        self.assertTrue(rows[0]["is_live"])
        self.assertEqual(rows[0]["minister_name"], "Rev Test")
        self.assertNotIn("transcript", rows[0])
        self.assertNotIn("description", rows[0])

    def test_limit_is_capped(self):
        now = timezone.now()
        for i in range(60):
            make_sermon(self.branch, f"S{i:02d}", now - timedelta(minutes=i))
        default = self.client.get(SERMONS_URL, {"branch": "chilanga"}).data["sermons"]
        self.assertEqual(len(default), 20)
        asked = self.client.get(SERMONS_URL, {"branch": "chilanga", "limit": "500"}).data["sermons"]
        self.assertEqual(len(asked), 50)
        bad = self.client.get(SERMONS_URL, {"branch": "chilanga", "limit": "lots"}).data["sermons"]
        self.assertEqual(len(bad), 20)


class AppMessagesTests(APITestCase):
    def setUp(self):
        self.branch = make_branch("chilanga")
        self.other = make_branch("kanyama")
        self.minister = make_minister(self.branch)
        self.today = timezone.localdate()

    def test_requires_a_branch_and_a_known_active_one(self):
        self.assertEqual(self.client.get(MESSAGES_URL).status_code, 400)
        self.assertEqual(self.client.get(MESSAGES_URL, {"branch": "nowhere"}).status_code, 404)

    def test_only_public_messages_newest_first_lean_fields(self):
        make_message(self.minister, self.today - timedelta(days=2), title="Older")
        make_message(self.minister, self.today, title="Today")
        make_message(self.minister, self.today, status="pending_review", title="Draft")
        make_message(self.minister, self.today + timedelta(days=1), title="Future")
        make_message(make_minister(self.other), self.today, title="Kanyama")
        rows = self.client.get(MESSAGES_URL, {"branch": "chilanga"}).data["messages"]
        self.assertEqual([r["title"] for r in rows], ["Today", "Older"])
        self.assertEqual(set(rows[0]), {"id", "title", "reference_verse", "date"})
        self.assertNotIn("message", rows[0])

    def test_search_matches_title_and_reference_case_insensitively(self):
        make_message(self.minister, self.today, title="The Good Shepherd", reference_verse="Psalm 23:1")
        make_message(self.minister, self.today - timedelta(days=1), title="Grace", reference_verse="Ephesians 2:8")
        rows = self.client.get(MESSAGES_URL, {"branch": "chilanga", "q": "shepherd"}).data["messages"]
        self.assertEqual([r["title"] for r in rows], ["The Good Shepherd"])
        rows = self.client.get(MESSAGES_URL, {"branch": "chilanga", "q": "EPHESIANS"}).data["messages"]
        self.assertEqual([r["title"] for r in rows], ["Grace"])
        rows = self.client.get(MESSAGES_URL, {"branch": "chilanga", "q": "nothing matches this"}).data["messages"]
        self.assertEqual(rows, [])

    def test_limit_is_capped(self):
        for i in range(250):
            make_message(self.minister, self.today - timedelta(days=i), title=f"M{i:03d}")
        self.assertEqual(len(self.client.get(MESSAGES_URL, {"branch": "chilanga"}).data["messages"]), 100)
        self.assertEqual(
            len(self.client.get(MESSAGES_URL, {"branch": "chilanga", "limit": "500"}).data["messages"]), 200,
        )


class AppMessageDetailTests(APITestCase):
    def setUp(self):
        self.branch = make_branch("chilanga")
        self.other = make_branch("kanyama")
        self.minister = make_minister(self.branch)
        self.today = timezone.localdate()

    def test_full_message_for_its_branch_only(self):
        msg = make_message(self.minister, self.today, title="Peace")
        response = self.client.get(detail_url(msg.pk), {"branch": "chilanga"})
        data = response.data
        self.assertEqual(data["title"], "Peace")
        self.assertEqual(data["message"], "Body of Peace.")
        self.assertEqual(data["verse_text"], "For God so loved the world")
        self.assertEqual(data["minister_name"], "Rev Test")
        self.assertEqual(response.json()["date"], self.today.isoformat())

    def test_other_branch_unpublished_and_future_messages_are_not_found(self):
        mine = make_message(self.minister, self.today)
        theirs = make_message(make_minister(self.other), self.today)
        draft = make_message(self.minister, self.today, status="pending_review")
        future = make_message(self.minister, self.today + timedelta(days=1))
        for msg in (theirs, draft, future):
            self.assertEqual(self.client.get(detail_url(msg.pk), {"branch": "chilanga"}).status_code, 404)
        self.assertEqual(self.client.get(detail_url(mine.pk), {"branch": "kanyama"}).status_code, 404)
        self.assertEqual(self.client.get(detail_url(mine.pk)).status_code, 400)
        self.assertEqual(self.client.get(detail_url(999999), {"branch": "chilanga"}).status_code, 404)


class LiveDetectionScheduleTests(APITestCase):
    def test_the_beat_sync_runs_every_five_minutes_so_live_is_picked_up_quickly(self):
        from django.conf import settings
        entry = settings.CELERY_BEAT_SCHEDULE["sync-youtube-sermons"]
        self.assertEqual(entry["task"], "church_erp.content.tasks.sync_youtube_sermons")
        self.assertLessEqual(float(entry["schedule"]), 300.0)


# --- T02: app API additions (ids, recent events, favourites check, cache headers) ---
from datetime import time as _time  # noqa: E402

from church_erp.api.tests.test_app_home import URL as HOME_URL  # noqa: E402
from church_erp.content.models import Activity  # noqa: E402

FAVOURITES_URL = "/api/app/favourites/check/"
HYMNS_COLLECTIONS_URL = "/api/app/hymns/collections/"


def make_activity(branch, title, day, start=_time(9)):
    return Activity.objects.create(
        branch=branch, title=title, date=day, start_time=start, end_time=_time(10),
        details="d", location="Hall",
    )


class AppSermonIdTests(APITestCase):
    def setUp(self):
        self.branch = make_branch("chilanga")
        self.minister = make_minister(self.branch)
        self.today = timezone.localdate()

    def test_sermon_rows_have_id(self):
        now = timezone.now()
        s1 = make_sermon(self.branch, "One", now - timedelta(hours=2))
        s2 = make_sermon(self.branch, "Two", now - timedelta(hours=1), is_live=True)
        rows = self.client.get(SERMONS_URL, {"branch": "chilanga"}).data["sermons"]
        self.assertEqual({r["id"] for r in rows}, {s1.pk, s2.pk})
        self.assertEqual(rows[0]["id"], s2.pk)
        self.assertEqual(rows[0]["video_id"], s2.video_id)  # old field kept

        data = self.client.get(HOME_URL, {"branch": "chilanga"}).data
        self.assertEqual(data["live"]["id"], s2.pk)
        self.assertEqual([r["id"] for r in data["sermons"]], [s2.pk, s1.pk])
        # home's daily_message gains date and verse_text (additive only)
        msg = make_message(self.minister, self.today, title="Peace")
        data = self.client.get(HOME_URL, {"branch": "chilanga"}).data
        self.assertEqual(data["daily_message"]["id"], msg.pk)
        self.assertEqual(data["daily_message"]["date"], self.today)  # date object in response.data
        self.assertEqual(data["daily_message"]["verse_text"], "For God so loved the world")


class AppHomeRecentEventsTests(APITestCase):
    def setUp(self):
        self.branch = make_branch("chilanga")
        self.today = timezone.localdate()

    def test_home_recent_events_when_nothing_upcoming(self):
        make_activity(self.branch, "Three days ago", self.today - timedelta(days=3))
        make_activity(self.branch, "Yesterday late", self.today - timedelta(days=1), start=_time(18))
        make_activity(self.branch, "Yesterday early", self.today - timedelta(days=1), start=_time(8))
        make_activity(self.branch, "Last week", self.today - timedelta(days=7))
        make_activity(make_branch("kanyama"), "Elsewhere", self.today - timedelta(days=1))
        data = self.client.get(HOME_URL, {"branch": "chilanga"}).data
        self.assertEqual(data["events"], [])
        recent = data["recent_events"]
        self.assertEqual(len(recent), 3)
        self.assertEqual(
            [r["title"] for r in recent],
            ["Yesterday late", "Yesterday early", "Three days ago"],
        )
        self.assertEqual(set(recent[0]), {"id", "title", "date", "start_time", "end_time", "location"})

    def test_home_recent_events_empty_when_upcoming_exist(self):
        make_activity(self.branch, "Past", self.today - timedelta(days=1))
        make_activity(self.branch, "Soon", self.today + timedelta(days=2))
        data = self.client.get(HOME_URL, {"branch": "chilanga"}).data
        self.assertEqual(len(data["events"]), 1)
        self.assertEqual(data["recent_events"], [])


class AppFavouritesCheckTests(APITestCase):
    def setUp(self):
        self.branch = make_branch("chilanga")
        self.other = make_branch("kanyama")
        self.minister = make_minister(self.branch)
        self.today = timezone.localdate()

    def test_favourites_check_returns_existing_ids_only(self):
        now = timezone.now()
        good = make_sermon(self.branch, "Good", now)
        hidden = make_sermon(self.branch, "Hidden", now, is_hidden=True)
        other = make_sermon(self.other, "Elsewhere", now)
        response = self.client.get(FAVOURITES_URL, {
            "branch": "chilanga",
            "sermons": f"{good.pk},{hidden.pk},{other.pk},999999",
        })
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["branch"], {"slug": "chilanga", "name": "Chilanga"})
        self.assertEqual(response.data["sermons"], [good.pk])
        self.assertEqual(response.data["messages"], [])

        published = make_message(self.minister, self.today, title="Live one")
        draft = make_message(self.minister, self.today, status="pending_review", title="Draft")
        future = make_message(self.minister, self.today + timedelta(days=1), title="Future")
        other_msg = make_message(make_minister(self.other), self.today, title="Kanyama")
        response = self.client.get(FAVOURITES_URL, {
            "branch": "chilanga",
            "messages": f"{published.pk},{draft.pk},{future.pk},{other_msg.pk}",
        })
        self.assertEqual(response.data["messages"], [published.pk])
        # ids come back sorted ascending
        m2 = make_message(self.minister, self.today - timedelta(days=1), title="Older")
        response = self.client.get(FAVOURITES_URL, {
            "branch": "chilanga", "messages": f"{published.pk},{m2.pk}",
        })
        self.assertEqual(response.data["messages"], sorted([published.pk, m2.pk]))

    def test_favourites_check_ignores_junk_and_caps_at_200(self):
        now = timezone.now()
        good = make_sermon(self.branch, "Good", now)
        # junk mixed in; must not error and only valid positive integers are considered
        response = self.client.get(FAVOURITES_URL, {
            "branch": "chilanga", "sermons": f"abc,-1,0,,{good.pk},2.5",
        })
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["sermons"], [good.pk])
        # more than 200 ids: the rest are ignored (this id sits past the cap)
        filler = ",".join(str(i) for i in range(1_000_000, 1_000_200))  # ids that cannot exist
        response = self.client.get(FAVOURITES_URL, {
            "branch": "chilanga", "sermons": f"{filler},{good.pk}",
        })
        self.assertEqual(response.data["sermons"], [])
        response = self.client.get(FAVOURITES_URL, {
            "branch": "chilanga", "sermons": f"{good.pk},{filler}",
        })
        self.assertEqual(response.data["sermons"], [good.pk])

    def test_favourites_check_requires_branch(self):
        self.assertEqual(self.client.get(FAVOURITES_URL).status_code, 400)
        self.assertEqual(self.client.get(FAVOURITES_URL, {"branch": "nowhere"}).status_code, 404)


class AppCacheHeaderTests(APITestCase):
    def setUp(self):
        self.branch = make_branch("chilanga")

    def test_app_answers_are_cacheable(self):
        response = self.client.get(HOME_URL, {"branch": "chilanga"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers.get("Cache-Control"), "public, max-age=60")
        response = self.client.get(HYMNS_COLLECTIONS_URL)
        self.assertEqual(response.headers.get("Cache-Control"), "public, max-age=3600")
        # a 400 answer is not cacheable
        response = self.client.get(HOME_URL)
        self.assertEqual(response.status_code, 400)
        self.assertNotIn("public", response.headers.get("Cache-Control", ""))


class AppHomeQueryCountTests(APITestCase):
    def setUp(self):
        self.branch = make_branch("chilanga")
        self.today = timezone.localdate()

    def test_home_query_count(self):
        now = timezone.now()
        for i in range(5):
            make_sermon(self.branch, f"S{i}", now - timedelta(hours=i))
        with self.assertNumQueries(7):  # observed: 7 queries (branch, message, live, sermons, events, recent events, home-page verse)
            response = self.client.get(HOME_URL, {"branch": "chilanga"})
        self.assertEqual(response.status_code, 200)
