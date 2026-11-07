"""Change history (AGENT_EXECUTION_PLAN.md, Task 5.4).

Django's own history only covers the Django admin, so every change made
through the dashboard's API is recorded here: who, which branch, what and
when. Superusers read it at /api/staff-changes/."""
import io
from datetime import date

from django.conf import settings
from django.core.files.storage import storages
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from django.test import override_settings
from django.core.cache import cache
from django.urls import reverse
from PIL import Image
from rest_framework.test import APITestCase

from church_erp.accounts.models import User
from church_erp.content.models import Project
from church_erp.core.models import Minister, StaffChange
from church_erp.core.tests.helpers import make_branch

IN_MEMORY = {
    **settings.STORAGES,
    "default": {"BACKEND": "django.core.files.storage.InMemoryStorage"},
    "private": {"BACKEND": "django.core.files.storage.InMemoryStorage"},
}
CHANGES = reverse("staff-changes-list")


def picture():
    data = io.BytesIO()
    Image.new("RGB", (20, 20), "red").save(data, "JPEG")
    return SimpleUploadedFile("p.jpg", data.getvalue(), content_type="image/jpeg")


@override_settings(STORAGES=IN_MEMORY)
class HistoryTestCase(APITestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("setup_roles", verbosity=0)
        cls.alpha = make_branch("alpha")
        cls.beta = make_branch("beta")
        cls.boss = User.objects.create_superuser("boss", password="pw")
        cls.admin_a = User.objects.create_user("admin_a", password="pw", is_staff=True, branch=cls.alpha, role="branch_admin")
        cls.editor_a = User.objects.create_user("editor_a", password="pw", is_staff=True, branch=cls.alpha, role="content_editor")
        cls.project = Project.objects.create(branch=cls.alpha, title="Roof", description="d", start_date=date(2026, 1, 1))

    def setUp(self):
        # Staff saves are rate limited per account; start each test afresh.
        cache.clear()
        self.addCleanup(cache.clear)
        self.client.force_authenticate(self.editor_a)

    def last(self):
        return StaffChange.objects.order_by("-pk").first()

    def entry(self, change):
        return (change.username, change.branch.slug if change.branch else None, change.section, change.action,
                change.target, sorted(change.changes))


class ContentTests(HistoryTestCase):
    def url(self, section="projects", pk=None):
        if pk:
            return reverse(f"staff-{section}-detail", args=["alpha", pk])
        return reverse(f"staff-{section}-list", args=["alpha"])

    def test_adding_changing_and_deleting(self):
        response = self.client.post(self.url(), {
            "title": "Hall", "description": "d", "start_date": "2026-02-01", "status": "PENDING", "progress": 0,
        }, format="json")
        self.assertEqual(self.entry(self.last()), ("editor_a", "alpha", "projects", "added", "Hall", []))
        self.assertEqual(self.last().target_id, str(response.data["id"]))

        self.client.patch(self.url(pk=self.project.pk), {"title": "New roof", "progress": 40, "description": "d"}, format="json")
        # Only what really changed: the description was sent but stayed the same.
        self.assertEqual(self.entry(self.last()), ("editor_a", "alpha", "projects", "changed", "New roof", ["progress", "title"]))

        self.client.delete(self.url(pk=self.project.pk))
        self.assertEqual(self.entry(self.last()), ("editor_a", "alpha", "projects", "deleted", "New roof", []))

    def test_saving_without_changes_records_nothing(self):
        self.client.patch(self.url(pk=self.project.pk), {"title": "Roof"}, format="json")
        self.assertFalse(StaffChange.objects.exists())

    def test_refused_changes_record_nothing(self):
        self.client.patch(self.url(pk=self.project.pk), {"progress": 500}, format="json")
        self.client.post(reverse("staff-projects-list", args=["beta"]), {"title": "x"}, format="json")
        self.assertFalse(StaffChange.objects.exists())

    def test_publishing_a_message(self):
        minister = Minister.objects.create(branch=self.alpha, name="Banda")
        response = self.client.post(self.url("messages"), {
            "minister": minister.pk, "title": "Light", "message": "m", "date": "2026-11-07",
        }, format="json")
        self.client.patch(self.url("messages", response.data["id"]), {"status": "published"}, format="json")
        self.assertEqual(self.entry(self.last()), ("editor_a", "alpha", "messages", "changed", "Light", ["status"]))

    def test_minister_photos(self):
        minister = Minister.objects.create(branch=self.alpha, name="Banda")
        self.client.post(reverse("staff-ministers-photo", args=["alpha", minister.pk]), {"image": picture()}, format="multipart")
        self.assertEqual(self.entry(self.last()), ("editor_a", "alpha", "ministers", "changed", "Banda", ["photo"]))
        self.client.delete(reverse("staff-ministers-photo", args=["alpha", minister.pk]))
        self.assertEqual(StaffChange.objects.count(), 2)

    def test_media_files(self):
        field = __import__("church_erp.media_library.models", fromlist=["MediaAsset"]).MediaAsset._meta.get_field("file")
        original = field.storage
        field.storage = storages["private"]
        self.addCleanup(setattr, field, "storage", original)
        pdf = SimpleUploadedFile("Minutes.pdf", b"%PDF-1.7\n%%EOF\n")
        response = self.client.post(self.url("media"), {"file": pdf}, format="multipart")
        self.assertEqual(self.entry(self.last()), ("editor_a", "alpha", "media", "added", "Minutes", []))
        self.client.delete(self.url("media", response.data["id"]))
        self.assertEqual(self.last().action, "deleted")


class PagesAndDetailsTests(HistoryTestCase):
    def test_page_wording(self):
        url = reverse("page-content-page", args=["alpha", "home"])
        self.client.put(url, {"fields": {"tagline": "A warm welcome"}}, format="json")
        self.assertEqual(self.entry(self.last()), ("editor_a", "alpha", "pages", "changed", "home", ["tagline"]))
        self.client.put(url, {"fields": {"tagline": "A warm welcome"}}, format="json")
        self.assertEqual(StaffChange.objects.count(), 1)

    def test_page_images(self):
        url = reverse("page-image", args=["alpha", "home", "hero_image"])
        self.client.post(url, {"image": picture()}, format="multipart")
        self.assertEqual(self.entry(self.last()), ("editor_a", "alpha", "pages", "changed", "home", ["hero_image"]))
        self.client.delete(url)
        self.assertEqual(StaffChange.objects.count(), 2)

    def test_national_pages_have_no_branch(self):
        self.client.force_authenticate(self.boss)
        self.client.put(reverse("page-content-page", args=["national", "home"]), {"fields": {"hero_title": "Welcome"}}, format="json")
        self.assertEqual(self.entry(self.last())[:4], ("boss", None, "pages", "changed"))

    def test_branch_details(self):
        self.client.patch(reverse("staff-branch-details", args=["alpha"]), {"contact_phone": "0977 000 000"}, format="json")
        self.assertEqual(self.entry(self.last()), ("editor_a", "alpha", "details", "changed", "Alpha", ["contact_phone"]))


class PeopleAndBranchesTests(HistoryTestCase):
    def test_staff_changes(self):
        self.client.force_authenticate(self.admin_a)
        response = self.client.post(reverse("staff-people-list"), {"username": "newbie"}, format="json")
        pk = response.data["id"]
        passwords = [response.data["temporary_password"]]
        self.assertEqual(self.entry(self.last()), ("admin_a", "alpha", "people", "added", "newbie", []))
        for name, action in (("suspend", "suspended"), ("restore", "restored"), ("reset-password", "password reset")):
            answer = self.client.post(reverse(f"staff-people-{name}", args=[pk]))
            self.assertEqual(self.last().action, action)
        passwords.append(answer.data["temporary_password"])
        self.client.patch(reverse("staff-people-detail", args=[pk]), {"first_name": "Grace"}, format="json")
        self.assertEqual(self.entry(self.last()), ("admin_a", "alpha", "people", "changed", "newbie", ["first_name"]))
        # The temporary passwords are never kept anywhere readable.
        for change in StaffChange.objects.all():
            for password in passwords:
                self.assertNotIn(password, f"{change.target} {change.changes} {change.target_id}")

    def test_two_step_reset(self):
        self.client.force_authenticate(self.boss)
        self.client.post(reverse("staff-people-reset-two-factor", args=[self.admin_a.pk]))
        self.assertEqual(self.entry(self.last()), ("boss", "alpha", "people", "two-step login reset", "admin_a", []))

    def test_branches(self):
        self.client.force_authenticate(self.boss)
        self.client.post(reverse("staff-branches-list"), {"name": "Kabwe", "slug": "kabwe"}, format="json")
        self.assertEqual(self.entry(self.last()), ("boss", "kabwe", "branches", "added", "Kabwe", []))
        self.client.patch(reverse("staff-branches-detail", args=["kabwe"]), {"is_active": False}, format="json")
        self.assertEqual(self.entry(self.last()), ("boss", "kabwe", "branches", "changed", "Kabwe", ["is_active"]))


class ReadingTests(HistoryTestCase):
    def test_only_superusers_read_it(self):
        self.assertEqual(self.client.get(CHANGES).status_code, 403)
        self.client.force_authenticate(self.admin_a)
        self.assertEqual(self.client.get(CHANGES).status_code, 403)
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(CHANGES).status_code, 401)

    def test_newest_first_and_filters(self):
        StaffChange.objects.create(user=self.editor_a, username="editor_a", branch=self.alpha, section="projects", action="added", target="A")
        StaffChange.objects.create(user=self.boss, username="boss", branch=self.beta, section="pages", action="changed", target="B")
        self.client.force_authenticate(self.boss)
        rows = self.client.get(CHANGES).data["results"]
        self.assertEqual([r["target"] for r in rows], ["B", "A"])
        self.assertEqual(rows[0]["branch"], "beta")
        self.assertEqual(rows[0]["branch_name"], "Beta")
        self.assertIn("at", rows[0])
        targets = lambda **q: [r["target"] for r in self.client.get(CHANGES, q).data["results"]]  # noqa: E731
        self.assertEqual(targets(branch="alpha"), ["A"])
        self.assertEqual(targets(person="boss"), ["B"])
        self.assertEqual(targets(section="projects"), ["A"])

    def test_it_cannot_be_changed_through_the_api(self):
        self.client.force_authenticate(self.boss)
        self.assertEqual(self.client.post(CHANGES, {"target": "x"}, format="json").status_code, 405)

    def test_entries_outlive_the_account(self):
        StaffChange.objects.create(user=self.editor_a, username="editor_a", branch=self.alpha, section="projects", action="added", target="A")
        self.editor_a.delete()
        self.client.force_authenticate(self.boss)
        self.assertEqual(self.client.get(CHANGES).data["results"][0]["username"], "editor_a")
