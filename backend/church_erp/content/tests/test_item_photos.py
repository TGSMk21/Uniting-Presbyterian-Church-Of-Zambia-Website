"""Photos on projects and activities (owner's request, 2026-11-08).

Staff add up to 12 photos to a project or activity at
/api/staff/<branch>/<projects|activities>/<id>/photos/ and remove them at
.../photos/<photo id>/. Photos are checked and re-saved like page images
and are public, since they're for the website."""
import io
import shutil
import tempfile
from datetime import date, time

from django.core.cache import cache
from django.core.files.storage import FileSystemStorage, default_storage
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.urls import reverse
from PIL import Image
from rest_framework.test import APITestCase

from church_erp.accounts.models import User
from church_erp.content import staff_content
from church_erp.content.models import Activity, ActivityPhoto, Project, ProjectPhoto
from church_erp.core.models import StaffChange
from church_erp.core.tests.helpers import make_branch

MEDIA = tempfile.mkdtemp(prefix="item-photos-")


def jpeg(name="photo.jpg", size=(60, 40)):
    data = io.BytesIO()
    Image.new("RGB", size, "green").save(data, "JPEG")
    return SimpleUploadedFile(name, data.getvalue(), content_type="image/jpeg")


@override_settings(STORAGES={
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage", "OPTIONS": {"location": MEDIA, "base_url": "/media/"}},
    "staticfiles": {"BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"},
    "private": {"BACKEND": "django.core.files.storage.InMemoryStorage"},
})
class ItemPhotoTests(APITestCase):
    KINDS = {
        "projects": (Project, ProjectPhoto, "project"),
        "activities": (Activity, ActivityPhoto, "activity"),
    }

    @classmethod
    def setUpTestData(cls):
        cls.alpha = make_branch("alpha")
        cls.beta = make_branch("beta")
        cls.editor = User.objects.create_user("editor", password="pw", is_staff=True, branch=cls.alpha, role="content_editor")
        cls.items = {
            "projects": Project.objects.create(branch=cls.alpha, title="Roof", description="d", start_date=date(2026, 1, 1)),
            "activities": Activity.objects.create(branch=cls.alpha, title="Rally", date=date(2026, 12, 1),
                                                  start_time=time(9), end_time=time(12), location="Hall", details="d"),
        }

    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        shutil.rmtree(MEDIA, ignore_errors=True)

    def setUp(self):
        cache.clear()
        self.addCleanup(cache.clear)
        self.client.force_authenticate(self.editor)

    def upload(self, section, file=None, scope="alpha"):
        url = reverse(f"staff-{section}-photos", args=[scope, self.items[section].pk])
        return self.client.post(url, {"image": file or jpeg()}, format="multipart")

    def test_staff_add_photos_which_are_resaved_and_listed_in_order(self):
        for section, (_, photo_model, _) in self.KINDS.items():
            with self.subTest(section):
                first = self.upload(section)
                second = self.upload(section, jpeg("second.jpg"))
                self.assertEqual(first.status_code, 201, first.data)
                photos = second.data["photos"]
                self.assertEqual(len(photos), 2)
                self.assertTrue(all(p["url"].endswith(".webp") for p in photos))
                stored = photo_model.objects.filter(**{self.KINDS[section][2]: self.items[section]})
                self.assertEqual([p.pk for p in stored.order_by("order", "pk")], [p["id"] for p in photos])
                self.assertTrue(all(default_storage.exists(p.image.name) for p in stored))
                detail = self.client.get(reverse(f"staff-{section}-detail", args=["alpha", self.items[section].pk])).data
                self.assertEqual([p["id"] for p in detail["photos"]], [p["id"] for p in photos])

    def test_the_public_lists_show_the_photos(self):
        self.upload("projects")
        self.upload("activities")
        self.client.force_authenticate(None)
        for url in (reverse("project-list") + "?branch=alpha", reverse("activity-list") + "?branch=alpha"):
            with self.subTest(url):
                row = self.client.get(url).data["results"][0]
                self.assertEqual(len(row["photos"]), 1)
                self.assertTrue(row["photos"][0]["url"].startswith("http"))

    def test_things_that_arent_photos_are_refused(self):
        response = self.upload("projects", SimpleUploadedFile("notes.jpg", b"not a photo"))
        self.assertEqual(response.status_code, 400)
        self.assertIn("image", response.data)
        self.assertEqual(self.client.post(
            reverse("staff-projects-photos", args=["alpha", self.items["projects"].pk]), {}, format="multipart",
        ).status_code, 400)
        self.assertFalse(ProjectPhoto.objects.exists())

    def test_there_is_a_limit_per_item(self):
        original = staff_content.MAX_ITEM_PHOTOS
        staff_content.MAX_ITEM_PHOTOS = 2
        self.addCleanup(setattr, staff_content, "MAX_ITEM_PHOTOS", original)
        self.upload("projects")
        self.upload("projects")
        response = self.upload("projects")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(ProjectPhoto.objects.count(), 2)

    def test_removing_a_photo_deletes_its_file(self):
        photo_id = self.upload("projects").data["photos"][0]["id"]
        name = ProjectPhoto.objects.get(pk=photo_id).image.name
        url = reverse("staff-projects-photo", args=["alpha", self.items["projects"].pk, photo_id])
        response = self.client.delete(url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["photos"], [])
        self.assertFalse(default_storage.exists(name))

    def test_deleting_the_item_deletes_its_photo_files(self):
        self.upload("activities")
        name = ActivityPhoto.objects.get().image.name
        self.client.delete(reverse("staff-activities-detail", args=["alpha", self.items["activities"].pk]))
        self.assertFalse(default_storage.exists(name))

    def test_changes_are_recorded(self):
        self.upload("projects")
        change = StaffChange.objects.filter(section="projects").last()
        self.assertEqual((change.action, change.changes), ("changed", ["photos"]))

    def test_other_branches_cant_add_or_remove(self):
        other = Project.objects.create(branch=self.beta, title="B", description="d", start_date=date(2026, 1, 1))
        photo = ProjectPhoto.objects.create(project=other, image="item_photos/x.webp")
        self.assertEqual(self.client.post(reverse("staff-projects-photos", args=["beta", other.pk]), {"image": jpeg()}, format="multipart").status_code, 403)
        self.assertEqual(self.client.post(reverse("staff-projects-photos", args=["alpha", other.pk]), {"image": jpeg()}, format="multipart").status_code, 404)
        self.assertEqual(self.client.delete(reverse("staff-projects-photo", args=["alpha", other.pk, photo.pk])).status_code, 404)
        # A photo of another item can't be removed through this one.
        self.assertEqual(self.client.delete(reverse("staff-projects-photo", args=["alpha", self.items["projects"].pk, photo.pk])).status_code, 404)
        self.assertTrue(ProjectPhoto.objects.filter(pk=photo.pk).exists())
