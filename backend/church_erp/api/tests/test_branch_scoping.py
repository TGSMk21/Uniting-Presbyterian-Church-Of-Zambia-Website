"""Branch scoping on the REST API (AGENT_EXECUTION_PLAN.md, Task 0.5)."""
from django.db import IntegrityError
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase

from church_erp.accounts.models import User
from church_erp.content.models import Page, Project, Sermon
from church_erp.core.models import Minister
from church_erp.core.tests.helpers import make_branch, make_branch_content
from church_erp.finance.models import GivingRecord


def make_api_staff(username, branch, role="content_editor", **extra):
    return User.objects.create_user(
        username, password="pw", is_staff=True, branch=branch, role=role, **extra
    )


class ApiScopingTestCase(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.branch_a = make_branch("alpha")
        cls.branch_b = make_branch("beta")
        cls.recorder = User.objects.create_user("recorder")
        cls.a = make_branch_content(cls.branch_a, cls.recorder)
        cls.b = make_branch_content(cls.branch_b, cls.recorder)
        cls.staff_a = make_api_staff("staff_a", cls.branch_a)

    def as_user(self, user):
        self.client.force_authenticate(user)

    def ids(self, response):
        return {row["id"] for row in response.data["results"]}


class PublicReadTests(ApiScopingTestCase):
    def test_anonymous_can_list_a_branch_sermons(self):
        response = self.client.get(reverse("sermon-list"), {"branch": "alpha"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.ids(response), {self.a["sermon"].pk})

    def test_anonymous_cannot_write(self):
        response = self.client.post(reverse("project-list"), {}, format="json")
        self.assertIn(response.status_code, (401, 403, 405))
        self.assertEqual(Project.objects.count(), 2)


# Writes to sermons, projects and activities go through the staff API, which has
# its own tests in content/tests/test_staff_content.py.


# Ministers are changed through the staff API too; see content/tests/test_staff_people.py.


# Daily messages are written through the staff API, and the public address only
# shows published ones; see ai_messages/tests/test_staff_messages.py.


class PageApiTests(ApiScopingTestCase):
    def test_staff_see_unpublished_pages_of_own_branch_only(self):
        self.as_user(self.staff_a)
        response = self.client.get(reverse("page-list"))
        self.assertEqual(self.ids(response), {self.a["page"].pk})

    def test_public_sees_no_unpublished_pages(self):
        response = self.client.get(reverse("page-list"))
        self.assertEqual(self.ids(response), set())


class MediaApiTests(ApiScopingTestCase):
    def test_staff_list_only_own_branch_media(self):
        self.as_user(self.staff_a)
        response = self.client.get(reverse("mediaasset-list"))
        self.assertEqual(self.ids(response), {self.a["mediaasset"].pk})


class GivingRecordApiTests(ApiScopingTestCase):
    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        cls.finance_a = make_api_staff("finance_a", cls.branch_a, role="finance_admin")

    def giving_payload(self, branch, ref, **extra):
        return {
            "branch": branch.pk, "amount": "15.00", "giving_type": "tithe",
            "payment_method": "cash", "reference_number": ref, **extra,
        }

    def test_content_editor_is_forbidden(self):
        self.as_user(self.staff_a)
        self.assertEqual(self.client.get(reverse("givingrecord-list")).status_code, 403)

    def test_finance_admin_sees_only_own_branch(self):
        self.as_user(self.finance_a)
        response = self.client.get(reverse("givingrecord-list"))
        self.assertEqual(self.ids(response), {self.a["givingrecord"].pk})

    def test_finance_admin_cannot_record_for_other_branch(self):
        self.as_user(self.finance_a)
        response = self.client.post(
            reverse("givingrecord-list"), self.giving_payload(self.branch_b, "x-1"), format="json"
        )
        self.assertEqual(response.status_code, 403)

    def test_recorded_by_is_the_requesting_user(self):
        self.as_user(self.finance_a)
        response = self.client.post(
            reverse("givingrecord-list"),
            self.giving_payload(self.branch_a, "a-2", recorded_by=self.recorder.pk),
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(GivingRecord.objects.get(reference_number="a-2").recorded_by, self.finance_a)

    def test_giving_records_cannot_be_deleted(self):
        self.as_user(self.finance_a)
        response = self.client.delete(
            reverse("givingrecord-detail", args=[self.a["givingrecord"].pk])
        )
        self.assertEqual(response.status_code, 405)
        self.assertTrue(GivingRecord.objects.filter(pk=self.a["givingrecord"].pk).exists())


class SermonLookupTests(ApiScopingTestCase):
    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        # The same YouTube video posted by both branches.
        cls.shared_a = Sermon.objects.create(
            branch=cls.branch_a, title="Shared A", video_id="shared", preached_at=timezone.now()
        )
        cls.shared_b = Sermon.objects.create(
            branch=cls.branch_b, title="Shared B", video_id="shared", preached_at=timezone.now()
        )

    def test_lookup_with_branch_returns_that_branch_sermon(self):
        response = self.client.get(reverse("sermon-detail", args=["shared"]), {"branch": "beta"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["id"], self.shared_b.pk)

    def test_ambiguous_lookup_without_branch_is_404_not_500(self):
        response = self.client.get(reverse("sermon-detail", args=["shared"]))
        self.assertEqual(response.status_code, 404)

    def test_video_id_is_unique_within_a_branch(self):
        with self.assertRaises(IntegrityError):
            Sermon.objects.create(
                branch=self.branch_a, title="Dup", video_id="shared", preached_at=timezone.now()
            )

    def test_blank_video_ids_may_repeat_within_a_branch(self):
        for title in ("No video 1", "No video 2"):
            Sermon.objects.create(branch=self.branch_a, title=title, preached_at=timezone.now())
        self.assertEqual(Sermon.objects.filter(branch=self.branch_a, video_id="").count(), 2)
