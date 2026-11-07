"""Daily messages from the dashboard (AGENT_EXECUTION_PLAN.md, Task 5.3).

Staff list, write and publish their own branch's messages at
/api/staff/<branch>/messages/. The public address only ever shows published
messages whose day has come."""
from datetime import timedelta

from django.core.cache import cache
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase

from church_erp.accounts.models import User
from church_erp.ai_messages.models import DailyMessage
from church_erp.core.models import Minister
from church_erp.core.tests.helpers import make_branch


def staff(username, branch=None, role="content_editor", **extra):
    return User.objects.create_user(username, password="pw", is_staff=True, branch=branch, role=role, **extra)


def list_url(scope):
    return reverse("staff-messages-list", args=[scope])


def detail_url(scope, pk):
    return reverse("staff-messages-detail", args=[scope, pk])


class MessagesTestCase(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.alpha = make_branch("alpha")
        cls.beta = make_branch("beta")
        cls.editor = staff("editor", cls.alpha)
        cls.minister_a = Minister.objects.create(branch=cls.alpha, name="Banda")
        cls.minister_b = Minister.objects.create(branch=cls.beta, name="Phiri")
        cls.today = timezone.localdate()

    def setUp(self):
        # Staff saves are rate limited per account; start each test afresh.
        cache.clear()
        self.addCleanup(cache.clear)
        self.client.force_authenticate(self.editor)

    def message(self, minister=None, **extra):
        values = {"title": "Light", "message": "Body", "date": self.today, **extra}
        return DailyMessage.objects.create(minister=minister or self.minister_a, **values)

    def payload(self, **extra):
        return {
            "minister": self.minister_a.pk, "title": "Light", "message": "Body",
            "date": self.today.isoformat(), **extra,
        }

    def ids(self, response):
        return [row["id"] for row in response.data["results"]]


class AccessTests(MessagesTestCase):
    def test_signed_out_is_refused(self):
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(list_url("alpha")).status_code, 401)

    def test_other_branch_is_refused(self):
        self.message(self.minister_b)
        self.assertEqual(self.client.get(list_url("beta")).status_code, 403)
        self.assertEqual(self.client.post(list_url("beta"), self.payload(), format="json").status_code, 403)

    def test_roles_without_content_rights_are_refused(self):
        self.client.force_authenticate(staff("treasurer", self.alpha, role="finance_admin"))
        self.assertEqual(self.client.get(list_url("alpha")).status_code, 403)

    def test_unknown_and_closed_branches_are_not_found(self):
        self.assertEqual(self.client.get(list_url("nowhere")).status_code, 404)
        closed = make_branch("closed")
        closed.is_active = False
        closed.save()
        self.client.force_authenticate(staff("closed_ed", closed))
        self.assertEqual(self.client.get(list_url("closed")).status_code, 404)

    def test_superuser_can_manage_any_branch(self):
        boss = User.objects.create_superuser("boss", password="pw")
        self.client.force_authenticate(boss)
        self.message(self.minister_b)
        self.assertEqual(self.client.get(list_url("beta")).status_code, 200)


class ListTests(MessagesTestCase):
    def test_lists_every_status_of_own_branch_newest_first(self):
        old = self.message(date=self.today - timedelta(days=2), status="published")
        draft = self.message(date=self.today + timedelta(days=1))
        turned_down = self.message(date=self.today, status="rejected")
        self.message(self.minister_b)
        self.assertEqual(self.ids(self.client.get(list_url("alpha"))), [draft.pk, turned_down.pk, old.pk])

    def test_other_branchs_message_is_not_found(self):
        theirs = self.message(self.minister_b)
        self.assertEqual(self.client.get(detail_url("alpha", theirs.pk)).status_code, 404)
        self.assertEqual(self.client.patch(detail_url("alpha", theirs.pk), {"title": "x"}, format="json").status_code, 404)
        self.assertEqual(self.client.delete(detail_url("alpha", theirs.pk)).status_code, 404)

    def test_shows_who_published_and_the_minister_name(self):
        self.client.post(list_url("alpha"), self.payload(status="published"), format="json")
        row = self.client.get(list_url("alpha")).data["results"][0]
        self.assertEqual(row["minister_name"], "Banda")
        self.assertEqual(row["reviewed_by_name"], "editor")


class WriteTests(MessagesTestCase):
    def test_new_messages_are_drafts(self):
        response = self.client.post(list_url("alpha"), self.payload(), format="json")
        self.assertEqual(response.status_code, 201, response.data)
        saved = DailyMessage.objects.get(pk=response.data["id"])
        self.assertEqual(saved.status, "pending_review")
        self.assertIsNone(saved.published_at)
        self.assertIsNone(saved.reviewed_by)
        self.assertEqual(saved.verse_text, "")

    def test_minister_must_belong_to_this_branch(self):
        response = self.client.post(list_url("alpha"), self.payload(minister=self.minister_b.pk), format="json")
        self.assertEqual(response.status_code, 400)
        self.assertIn("minister", response.data)
        mine = self.message()
        response = self.client.patch(detail_url("alpha", mine.pk), {"minister": self.minister_b.pk}, format="json")
        self.assertEqual(response.status_code, 400)
        mine.refresh_from_db()
        self.assertEqual(mine.minister, self.minister_a)

    def test_publishing_records_who_and_when(self):
        draft = self.message()
        response = self.client.patch(detail_url("alpha", draft.pk), {"status": "published"}, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        draft.refresh_from_db()
        self.assertEqual(draft.reviewed_by, self.editor)
        self.assertIsNotNone(draft.published_at)

    def test_editing_a_published_message_keeps_when_it_was_published(self):
        first = timezone.now() - timedelta(days=3)
        published = self.message(status="published", published_at=first, reviewed_by=self.editor)
        other = staff("other", self.alpha)
        self.client.force_authenticate(other)
        self.client.patch(detail_url("alpha", published.pk), {"title": "Fixed typo"}, format="json")
        published.refresh_from_db()
        self.assertEqual(published.published_at, first)
        self.assertEqual(published.reviewed_by, self.editor)

    def test_unpublishing_clears_the_record(self):
        published = self.message(status="published", published_at=timezone.now(), reviewed_by=self.editor)
        self.client.patch(detail_url("alpha", published.pk), {"status": "pending_review"}, format="json")
        published.refresh_from_db()
        self.assertIsNone(published.published_at)
        self.assertIsNone(published.reviewed_by)

    def test_record_fields_cannot_be_set_directly(self):
        someone = staff("someone", self.alpha)
        response = self.client.post(
            list_url("alpha"),
            self.payload(reviewed_by=someone.pk, published_at="2020-01-01T00:00:00Z"),
            format="json",
        )
        saved = DailyMessage.objects.get(pk=response.data["id"])
        self.assertIsNone(saved.reviewed_by)
        self.assertIsNone(saved.published_at)

    def test_publish_time_cannot_be_changed_on_a_published_message(self):
        first = timezone.now() - timedelta(days=3)
        published = self.message(status="published", published_at=first, reviewed_by=self.editor)
        response = self.client.patch(
            detail_url("alpha", published.pk), {"published_at": "2020-01-01T00:00:00Z"}, format="json",
        )
        self.assertEqual(response.status_code, 200)
        published.refresh_from_db()
        self.assertEqual(published.published_at, first)

    def test_one_published_message_per_minister_per_day(self):
        self.message(status="published", published_at=timezone.now())
        response = self.client.post(list_url("alpha"), self.payload(status="published"), format="json")
        self.assertEqual(response.status_code, 400)
        self.assertIn("date", response.data)
        # Drafts for the same day are fine, and so is another minister's message.
        self.assertEqual(self.client.post(list_url("alpha"), self.payload(), format="json").status_code, 201)
        other = Minister.objects.create(branch=self.alpha, name="Mwale")
        response = self.client.post(list_url("alpha"), self.payload(minister=other.pk, status="published"), format="json")
        self.assertEqual(response.status_code, 201)

    def test_publishing_a_second_one_by_editing_is_refused_too(self):
        self.message(status="published", published_at=timezone.now())
        draft = self.message()
        response = self.client.patch(detail_url("alpha", draft.pk), {"status": "published"}, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertIn("date", response.data)
        # Saving the published one again isn't a clash with itself.
        published = DailyMessage.objects.get(status="published")
        response = self.client.patch(detail_url("alpha", published.pk), {"title": "Again"}, format="json")
        self.assertEqual(response.status_code, 200)

    def test_status_must_be_known(self):
        response = self.client.post(list_url("alpha"), self.payload(status="live"), format="json")
        self.assertEqual(response.status_code, 400)

    def test_lengths_are_limited(self):
        for field, size in (("title", 300), ("message", 10000), ("verse_text", 2000), ("reference_verse", 100)):
            response = self.client.post(list_url("alpha"), self.payload(**{field: "x" * (size + 1)}), format="json")
            self.assertEqual(response.status_code, 400, field)
            self.assertIn(field, response.data)
            response = self.client.post(
                list_url("alpha"), self.payload(**{field: "x" * size}, date=(self.today + timedelta(days=size)).isoformat()),
                format="json",
            )
            self.assertEqual(response.status_code, 201, field)

    def test_title_message_and_date_are_required(self):
        for field in ("title", "message", "date", "minister"):
            data = self.payload()
            del data[field]
            response = self.client.post(list_url("alpha"), data, format="json")
            self.assertEqual(response.status_code, 400, field)
            self.assertIn(field, response.data)

    def test_delete(self):
        mine = self.message()
        self.assertEqual(self.client.delete(detail_url("alpha", mine.pk)).status_code, 204)
        self.assertFalse(DailyMessage.objects.filter(pk=mine.pk).exists())


class PublicTests(MessagesTestCase):
    def public(self, **params):
        return self.client.get(reverse("dailymessage-list"), params)

    def test_only_published_messages_whose_day_has_come(self):
        shown = self.message(status="published", published_at=timezone.now())
        self.message(status="published", date=self.today + timedelta(days=1), title="Tomorrow")
        self.message(date=self.today - timedelta(days=1))
        self.message(status="rejected", date=self.today - timedelta(days=2))
        self.client.force_authenticate(None)
        self.assertEqual(self.ids(self.public()), [shown.pk])

    def test_staff_get_the_public_view_there_too(self):
        # Drafts are only on the staff address, so a signed-in browser can't leak them.
        self.message()
        self.assertEqual(self.ids(self.public()), [])

    def test_newest_day_first_then_newest_published(self):
        older = self.message(status="published", date=self.today - timedelta(days=1), published_at=timezone.now())
        early = self.message(status="published", published_at=timezone.now() - timedelta(hours=2))
        other = Minister.objects.create(branch=self.alpha, name="Mwale")
        late = self.message(other, status="published", published_at=timezone.now())
        self.assertEqual(self.ids(self.public(branch="alpha")), [late.pk, early.pk, older.pk])

    def test_filters_by_branch(self):
        self.message(status="published")
        theirs = self.message(self.minister_b, status="published")
        self.assertEqual(self.ids(self.public(branch="beta")), [theirs.pk])

    def test_cannot_be_written(self):
        self.assertEqual(self.client.post(reverse("dailymessage-list"), self.payload(), format="json").status_code, 405)
        mine = self.message(status="published")
        url = reverse("dailymessage-detail", args=[mine.pk])
        self.assertEqual(self.client.patch(url, {"title": "x"}, format="json").status_code, 405)
        self.assertEqual(self.client.delete(url).status_code, 405)

    def test_does_not_show_who_published(self):
        self.message(status="published", reviewed_by=self.editor)
        row = self.public().data["results"][0]
        self.assertNotIn("reviewed_by", row)
        self.assertNotIn("status", row)
