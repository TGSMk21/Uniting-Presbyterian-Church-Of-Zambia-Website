"""Sermons, projects and activities from the dashboard (AGENT_EXECUTION_PLAN.md, Task 5.3)."""
from datetime import date, datetime, time, timezone as dt_timezone

from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase

from church_erp.accounts.models import User
from church_erp.content.models import Activity, Project, Sermon
from church_erp.content.staff_content import video_id_from
from church_erp.core.tests.helpers import make_branch

from django.test import SimpleTestCase

VIDEO = "dQw4w9WgXcQ"


def staff(username, branch=None, role="content_editor", **extra):
    return User.objects.create_user(username, password="pw", is_staff=True, branch=branch, role=role, **extra)


def list_url(scope, section):
    return reverse(f"staff-{section}-list", args=[scope])


def detail_url(scope, section, pk):
    return reverse(f"staff-{section}-detail", args=[scope, pk])


class StaffContentTestCase(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.alpha = make_branch("alpha")
        cls.beta = make_branch("beta")
        cls.editor = staff("editor", cls.alpha)
        cls.sermon_a = Sermon.objects.create(
            branch=cls.alpha, title="Grace", video_id="aaaaaaaaaaa", preached_at=timezone.now(),
        )
        cls.sermon_b = Sermon.objects.create(
            branch=cls.beta, title="Beta sermon", video_id="bbbbbbbbbbb", preached_at=timezone.now(),
        )
        cls.project_a = Project.objects.create(
            branch=cls.alpha, title="Roof", description="New roof", start_date=date(2026, 1, 1),
        )
        cls.project_b = Project.objects.create(
            branch=cls.beta, title="Beta project", description="d", start_date=date(2026, 1, 1),
        )
        cls.activity_a = Activity.objects.create(
            branch=cls.alpha, title="Choir", date=date(2026, 12, 1), start_time=time(9), end_time=time(10),
            details="Practice", location="Hall",
        )
        cls.activity_b = Activity.objects.create(
            branch=cls.beta, title="Beta activity", date=date(2026, 12, 1), start_time=time(9),
            end_time=time(10), details="d", location="Hall",
        )

    def setUp(self):
        self.client.force_authenticate(self.editor)

    def ids(self, response):
        return {row["id"] for row in response.data["results"]}


class AccessTests(StaffContentTestCase):
    SECTIONS = ("sermons", "projects", "activities")

    def test_signed_out_is_refused(self):
        self.client.force_authenticate(None)
        for section in self.SECTIONS:
            self.assertEqual(self.client.get(list_url("alpha", section)).status_code, 401, section)

    def test_editor_lists_only_their_branch(self):
        expected = {"sermons": self.sermon_a, "projects": self.project_a, "activities": self.activity_a}
        for section, row in expected.items():
            response = self.client.get(list_url("alpha", section))
            self.assertEqual(response.status_code, 200, section)
            self.assertEqual(self.ids(response), {row.pk}, section)

    def test_branch_admin_can_manage_their_branch(self):
        self.client.force_authenticate(staff("admin_a", self.alpha, role="branch_admin"))
        self.assertEqual(self.client.get(list_url("alpha", "projects")).status_code, 200)

    def test_other_branch_is_refused(self):
        for section in self.SECTIONS:
            self.assertEqual(self.client.get(list_url("beta", section)).status_code, 403, section)
        response = self.client.post(list_url("beta", "projects"), {
            "title": "Sneaky", "description": "d", "start_date": "2026-01-01",
        }, format="json")
        self.assertEqual(response.status_code, 403)
        self.assertFalse(Project.objects.filter(title="Sneaky").exists())

    def test_other_branch_rows_are_not_found_through_own_branch(self):
        rows = {"sermons": self.sermon_b, "projects": self.project_b, "activities": self.activity_b}
        for section, row in rows.items():
            url = detail_url("alpha", section, row.pk)
            self.assertEqual(self.client.get(url).status_code, 404, section)
            self.assertEqual(self.client.patch(url, {"title": "Hijacked"}, format="json").status_code, 404, section)
        self.assertEqual(self.client.delete(detail_url("alpha", "projects", self.project_b.pk)).status_code, 404)
        self.project_b.refresh_from_db()
        self.assertEqual(self.project_b.title, "Beta project")

    def test_roles_without_content_editing_are_refused(self):
        for role in ("finance_admin", "super_admin"):
            self.client.force_authenticate(staff(f"{role}_user", self.alpha, role=role))
            self.assertEqual(self.client.get(list_url("alpha", "sermons")).status_code, 403, role)

    def test_staff_without_branch_are_refused(self):
        self.client.force_authenticate(staff("orphan"))
        self.assertEqual(self.client.get(list_url("alpha", "sermons")).status_code, 403)

    def test_non_staff_are_refused(self):
        self.client.force_authenticate(User.objects.create_user("member", branch=self.alpha))
        self.assertEqual(self.client.get(list_url("alpha", "sermons")).status_code, 403)

    def test_superuser_can_manage_any_branch(self):
        self.client.force_authenticate(User.objects.create_superuser("root", password="pw"))
        response = self.client.get(list_url("beta", "sermons"))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.ids(response), {self.sermon_b.pk})

    def test_unknown_and_inactive_branches_are_not_found(self):
        self.client.force_authenticate(User.objects.create_superuser("root", password="pw"))
        self.assertEqual(self.client.get(list_url("nowhere", "sermons")).status_code, 404)
        self.beta.is_active = False
        self.beta.save()
        self.assertEqual(self.client.get(list_url("beta", "sermons")).status_code, 404)

    def test_branch_in_the_request_is_ignored(self):
        response = self.client.post(list_url("alpha", "projects"), {
            "title": "Mine", "description": "d", "start_date": "2026-01-01", "branch": self.beta.pk,
        }, format="json")
        self.assertEqual(response.status_code, 201)
        self.assertEqual(Project.objects.get(title="Mine").branch, self.alpha)
        self.client.patch(detail_url("alpha", "projects", self.project_a.pk), {"branch": self.beta.pk}, format="json")
        self.project_a.refresh_from_db()
        self.assertEqual(self.project_a.branch, self.alpha)


class SermonTests(StaffContentTestCase):
    def add(self, **fields):
        payload = {"title": "New sermon", "video": VIDEO, "preached_at": "2026-11-08T10:00", **fields}
        return self.client.post(list_url("alpha", "sermons"), payload, format="json")

    def test_edits_title_series_verse_and_description(self):
        response = self.client.patch(detail_url("alpha", "sermons", self.sermon_a.pk), {
            "title": "Amazing grace", "series": "Ephesians", "reference_verse": "Eph 2:8",
            "description": "Saved by grace",
        }, format="json")
        self.assertEqual(response.status_code, 200)
        self.sermon_a.refresh_from_db()
        self.assertEqual(
            (self.sermon_a.title, self.sermon_a.series, self.sermon_a.reference_verse, self.sermon_a.description),
            ("Amazing grace", "Ephesians", "Eph 2:8", "Saved by grace"),
        )

    def test_youtube_details_cannot_be_changed(self):
        self.client.patch(detail_url("alpha", "sermons", self.sermon_a.pk), {
            "video": "ccccccccccc", "video_id": "ccccccccccc", "duration": "PT1H", "is_live": True,
            "transcript": "x",
        }, format="json")
        self.sermon_a.refresh_from_db()
        self.assertEqual(self.sermon_a.video_id, "aaaaaaaaaaa")
        self.assertEqual(self.sermon_a.duration, "")
        self.assertFalse(self.sermon_a.is_live)
        self.assertEqual(self.sermon_a.transcript, "")

    def test_title_is_required(self):
        response = self.client.patch(detail_url("alpha", "sermons", self.sermon_a.pk), {"title": " "}, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertIn("title", response.data)

    def test_long_description_is_refused(self):
        response = self.client.patch(
            detail_url("alpha", "sermons", self.sermon_a.pk), {"description": "x" * 5001}, format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("description", response.data)

    def test_adds_a_sermon_from_a_youtube_link(self):
        response = self.add(video=f"https://www.youtube.com/watch?v={VIDEO}&t=30s")
        self.assertEqual(response.status_code, 201)
        sermon = Sermon.objects.get(pk=response.data["id"])
        self.assertEqual((sermon.branch, sermon.video_id, sermon.title), (self.alpha, VIDEO, "New sermon"))
        self.assertEqual(sermon.preached_at, datetime(2026, 11, 8, 8, 0, tzinfo=dt_timezone.utc))

    def test_adding_needs_a_video_and_a_date(self):
        response = self.client.post(list_url("alpha", "sermons"), {"title": "No video"}, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertIn("video", response.data)
        self.assertIn("preached_at", response.data)

    def test_bad_link_is_refused_in_plain_words(self):
        response = self.add(video="https://example.com/watch?v=dQw4w9WgXcQ")
        self.assertEqual(response.status_code, 400)
        self.assertIn("YouTube", " ".join(response.data["video"]))

    def test_same_video_twice_is_refused(self):
        response = self.add(video="aaaaaaaaaaa")
        self.assertEqual(response.status_code, 400)
        self.assertIn("already", " ".join(response.data["video"]))
        self.assertEqual(Sermon.objects.filter(branch=self.alpha, video_id="aaaaaaaaaaa").count(), 1)

    def test_same_video_in_another_branch_is_allowed(self):
        self.assertEqual(self.add(video="bbbbbbbbbbb").status_code, 201)

    def test_sermons_cannot_be_deleted(self):
        response = self.client.delete(detail_url("alpha", "sermons", self.sermon_a.pk))
        self.assertEqual(response.status_code, 405)
        self.assertTrue(Sermon.objects.filter(pk=self.sermon_a.pk).exists())

    def test_hidden_sermons_stay_listed_for_staff(self):
        self.client.patch(detail_url("alpha", "sermons", self.sermon_a.pk), {"is_hidden": True}, format="json")
        response = self.client.get(list_url("alpha", "sermons"))
        self.assertEqual(self.ids(response), {self.sermon_a.pk})
        self.assertTrue(response.data["results"][0]["is_hidden"])

    def test_newest_first(self):
        older = Sermon.objects.create(
            branch=self.alpha, title="Older", video_id="ooooooooooo",
            preached_at=datetime(2020, 1, 1, tzinfo=dt_timezone.utc),
        )
        rows = self.client.get(list_url("alpha", "sermons")).data["results"]
        self.assertEqual([row["id"] for row in rows], [self.sermon_a.pk, older.pk])


class HiddenSermonPublicTests(StaffContentTestCase):
    def setUp(self):
        super().setUp()
        self.client.patch(detail_url("alpha", "sermons", self.sermon_a.pk), {"is_hidden": True}, format="json")
        self.client.force_authenticate(None)

    def test_hidden_sermon_is_left_off_the_public_list(self):
        response = self.client.get(reverse("sermon-list"), {"branch": "alpha"})
        self.assertEqual(response.data["results"], [])

    def test_hidden_sermon_page_is_not_found(self):
        response = self.client.get(reverse("sermon-detail", args=["aaaaaaaaaaa"]), {"branch": "alpha"})
        self.assertEqual(response.status_code, 404)

    def test_shown_again_when_unhidden(self):
        self.client.force_authenticate(self.editor)
        self.client.patch(detail_url("alpha", "sermons", self.sermon_a.pk), {"is_hidden": False}, format="json")
        self.client.force_authenticate(None)
        response = self.client.get(reverse("sermon-list"), {"branch": "alpha"})
        self.assertEqual([row["id"] for row in response.data["results"]], [self.sermon_a.pk])


class ProjectTests(StaffContentTestCase):
    def add(self, **fields):
        payload = {"title": "Borehole", "description": "Clean water", "start_date": "2026-02-01", **fields}
        return self.client.post(list_url("alpha", "projects"), payload, format="json")

    def test_adds_edits_and_deletes_a_project(self):
        response = self.add(status="ONGOING", progress=40, end_date="2026-12-31")
        self.assertEqual(response.status_code, 201)
        pk = response.data["id"]
        self.assertEqual(Project.objects.get(pk=pk).branch, self.alpha)
        response = self.client.patch(detail_url("alpha", "projects", pk), {"progress": 100, "status": "COMPLETED"},
                                     format="json")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(Project.objects.get(pk=pk).progress, 100)
        self.assertEqual(self.client.delete(detail_url("alpha", "projects", pk)).status_code, 204)
        self.assertFalse(Project.objects.filter(pk=pk).exists())

    def test_progress_must_be_a_percentage(self):
        for progress in (-1, 101):
            response = self.add(progress=progress)
            self.assertEqual(response.status_code, 400, progress)
            self.assertIn("progress", response.data)
        self.assertEqual(self.add(progress=0).status_code, 201)
        self.assertEqual(self.add(progress=100).status_code, 201)

    def test_end_date_cannot_be_before_start(self):
        response = self.add(start_date="2026-05-01", end_date="2026-04-30")
        self.assertEqual(response.status_code, 400)
        self.assertIn("end_date", response.data)
        self.assertEqual(self.add(start_date="2026-05-01", end_date="2026-05-01").status_code, 201)

    def test_end_date_checked_against_saved_start(self):
        response = self.client.patch(detail_url("alpha", "projects", self.project_a.pk), {"end_date": "2025-12-31"},
                                     format="json")
        self.assertEqual(response.status_code, 400)
        self.assertIn("end_date", response.data)

    def test_unknown_status_is_refused(self):
        response = self.add(status="CANCELLED")
        self.assertEqual(response.status_code, 400)
        self.assertIn("status", response.data)

    def test_required_fields(self):
        response = self.client.post(list_url("alpha", "projects"), {}, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(set(response.data), {"title", "description", "start_date"})


class ActivityTests(StaffContentTestCase):
    def add(self, **fields):
        payload = {
            "title": "Youth camp", "date": "2026-12-20", "start_time": "08:00", "end_time": "17:00",
            "details": "Bring a Bible", "location": "Church grounds", **fields,
        }
        return self.client.post(list_url("alpha", "activities"), payload, format="json")

    def test_adds_edits_and_deletes_an_activity(self):
        response = self.add()
        self.assertEqual(response.status_code, 201)
        pk = response.data["id"]
        self.assertEqual(Activity.objects.get(pk=pk).branch, self.alpha)
        response = self.client.patch(detail_url("alpha", "activities", pk), {"location": "Main hall"}, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(Activity.objects.get(pk=pk).location, "Main hall")
        self.assertEqual(self.client.delete(detail_url("alpha", "activities", pk)).status_code, 204)
        self.assertFalse(Activity.objects.filter(pk=pk).exists())

    def test_end_must_be_after_start(self):
        for end in ("08:00", "07:59"):
            response = self.add(start_time="08:00", end_time=end)
            self.assertEqual(response.status_code, 400, end)
            self.assertIn("end_time", response.data)

    def test_end_checked_against_saved_start(self):
        response = self.client.patch(detail_url("alpha", "activities", self.activity_a.pk), {"end_time": "08:00"},
                                     format="json")
        self.assertEqual(response.status_code, 400)
        self.assertIn("end_time", response.data)

    def test_required_fields(self):
        response = self.client.post(list_url("alpha", "activities"), {}, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(set(response.data), {"title", "date", "start_time", "end_time", "details", "location"})

    def test_latest_dates_first(self):
        earlier = Activity.objects.create(
            branch=self.alpha, title="Earlier", date=date(2026, 1, 1), start_time=time(9), end_time=time(10),
            details="d", location="Hall",
        )
        rows = self.client.get(list_url("alpha", "activities")).data["results"]
        self.assertEqual([row["id"] for row in rows], [self.activity_a.pk, earlier.pk])

    def test_new_activity_appears_in_public_upcoming_list(self):
        self.add(title="Carols", date="2099-12-20")
        self.client.force_authenticate(None)
        response = self.client.get(reverse("activity-list"), {"date__gte": "2099-01-01"})
        self.assertEqual([row["title"] for row in response.data["results"]], ["Carols"])


class PublicApiIsReadOnlyTests(StaffContentTestCase):
    def test_public_addresses_refuse_writes_even_for_superusers(self):
        self.client.force_authenticate(User.objects.create_superuser("root", password="pw"))
        attempts = [
            ("post", reverse("sermon-list")),
            ("patch", reverse("sermon-detail", args=["aaaaaaaaaaa"]) + "?branch=alpha"),
            ("delete", reverse("sermon-detail", args=["aaaaaaaaaaa"]) + "?branch=alpha"),
            ("post", reverse("project-list")),
            ("patch", reverse("project-detail", args=[self.project_a.pk])),
            ("delete", reverse("project-detail", args=[self.project_a.pk])),
            ("post", reverse("activity-list")),
            ("patch", reverse("activity-detail", args=[self.activity_a.pk])),
            ("delete", reverse("activity-detail", args=[self.activity_a.pk])),
        ]
        for method, url in attempts:
            response = getattr(self.client, method)(url, {"title": "Changed"}, format="json")
            self.assertEqual(response.status_code, 405, (method, url))
        self.assertTrue(Sermon.objects.filter(pk=self.sermon_a.pk, title="Grace").exists())
        self.assertTrue(Project.objects.filter(pk=self.project_a.pk, title="Roof").exists())
        self.assertTrue(Activity.objects.filter(pk=self.activity_a.pk, title="Choir").exists())


class VideoLinkTests(SimpleTestCase):
    def test_accepts_youtube_links_and_plain_ids(self):
        for text in (
            VIDEO,
            f" {VIDEO} ",
            f"https://www.youtube.com/watch?v={VIDEO}",
            f"https://youtube.com/watch?feature=share&v={VIDEO}",
            f"https://m.youtube.com/watch?v={VIDEO}",
            f"youtube.com/watch?v={VIDEO}",
            f"https://youtu.be/{VIDEO}?si=abc",
            f"https://www.youtube.com/live/{VIDEO}?si=abc",
            f"https://www.youtube.com/shorts/{VIDEO}",
            f"https://www.youtube.com/embed/{VIDEO}",
        ):
            self.assertEqual(video_id_from(text), VIDEO, text)

    def test_refuses_other_text(self):
        for text in (
            "",
            "dQw4w9WgXc",
            "dQw4w9WgXcQQ",
            "dQw4w9WgX!Q",
            f"https://example.com/watch?v={VIDEO}",
            f"https://youtube.com.evil.example/watch?v={VIDEO}",
            "https://www.youtube.com/watch",
            "https://www.youtube.com/@church",
            f"https://www.youtube.com/playlist?list={VIDEO}",
            f"ftp://www.youtube.com/watch?v={VIDEO}",
            f"javascript://www.youtube.com/watch?v={VIDEO}",
            f"https://www.youtube.com/c/{VIDEO}",
            f"https://www.youtube.com/channel/{VIDEO}",
            "https://youtu.be/tooShort",
            f"https://youtu.be/{VIDEO}Q",
            f"https://www.youtube.com/watch?v={VIDEO}Q",
            "https://www.youtube.com/live/abc",
        ):
            self.assertIsNone(video_id_from(text), text)
