"""Ministers and service times from the dashboard (AGENT_EXECUTION_PLAN.md, Task 5.3)."""
import io
from datetime import date, time

from django.conf import settings
from django.core.cache import cache
from django.core.files.storage import default_storage
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.urls import reverse
from PIL import Image
from rest_framework.test import APITestCase

from church_erp.accounts.models import User
from church_erp.ai_messages.models import DailyMessage
from church_erp.content.staff_content import MINISTER_PHOTO_SIDE
from church_erp.core.models import Minister, ServiceTime
from church_erp.core.tests.helpers import make_branch

IN_MEMORY = {**settings.STORAGES, "default": {"BACKEND": "django.core.files.storage.InMemoryStorage"}}


def staff(username, branch=None, role="content_editor"):
    return User.objects.create_user(username, password="pw", is_staff=True, branch=branch, role=role)


def picture(size=(40, 30), fmt="JPEG"):
    data = io.BytesIO()
    Image.new("RGB", size, "red").save(data, fmt)
    return SimpleUploadedFile(f"photo.{fmt.lower()}", data.getvalue(), content_type=f"image/{fmt.lower()}")


def list_url(scope, section):
    return reverse(f"staff-{section}-list", args=[scope])


def detail_url(scope, section, pk):
    return reverse(f"staff-{section}-detail", args=[scope, pk])


def photo_url(scope, pk):
    return reverse("staff-ministers-photo", args=[scope, pk])


class PeopleTestCase(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.alpha = make_branch("alpha")
        cls.beta = make_branch("beta")
        cls.editor = staff("editor", cls.alpha)
        cls.minister_a = Minister.objects.create(branch=cls.alpha, name="Banda", bio="Pastor")
        cls.minister_b = Minister.objects.create(branch=cls.beta, name="Beta minister")
        cls.service_a = ServiceTime.objects.create(
            branch=cls.alpha, day="Every Sunday", title="Main service", start_time=time(9), end_time=time(11),
        )
        cls.service_b = ServiceTime.objects.create(
            branch=cls.beta, day="Every Sunday", title="Beta service", start_time=time(9), end_time=time(11),
        )

    def setUp(self):
        cache.clear()
        self.addCleanup(cache.clear)
        self.client.force_authenticate(self.editor)

    def ids(self, response):
        return [row["id"] for row in response.data["results"]]


class AccessTests(PeopleTestCase):
    def test_signed_out_is_refused(self):
        self.client.force_authenticate(None)
        for section in ("ministers", "services"):
            self.assertEqual(self.client.get(list_url("alpha", section)).status_code, 401, section)
        self.assertEqual(self.client.post(photo_url("alpha", self.minister_a.pk), {}).status_code, 401)

    def test_editor_sees_only_their_branch(self):
        self.assertEqual(self.ids(self.client.get(list_url("alpha", "ministers"))), [self.minister_a.pk])
        self.assertEqual(self.ids(self.client.get(list_url("alpha", "services"))), [self.service_a.pk])

    def test_other_branch_is_refused(self):
        for section in ("ministers", "services"):
            self.assertEqual(self.client.get(list_url("beta", section)).status_code, 403, section)

    def test_other_branch_rows_are_not_found_through_own_branch(self):
        for section, row in (("ministers", self.minister_b), ("services", self.service_b)):
            url = detail_url("alpha", section, row.pk)
            self.assertEqual(self.client.patch(url, {"title": "X", "name": "X"}, format="json").status_code, 404)
            self.assertEqual(self.client.delete(url).status_code, 404)
        self.assertEqual(self.client.post(photo_url("alpha", self.minister_b.pk), {"image": picture()}).status_code, 404)
        self.assertTrue(Minister.objects.filter(pk=self.minister_b.pk, name="Beta minister").exists())
        self.assertTrue(ServiceTime.objects.filter(pk=self.service_b.pk).exists())

    def test_roles_without_content_editing_are_refused(self):
        self.client.force_authenticate(staff("finance", self.alpha, role="finance_admin"))
        self.assertEqual(self.client.get(list_url("alpha", "ministers")).status_code, 403)
        self.assertEqual(self.client.post(photo_url("alpha", self.minister_a.pk), {"image": picture()}).status_code, 403)

    def test_public_addresses_refuse_writes_even_for_superusers(self):
        self.client.force_authenticate(User.objects.create_superuser("root", password="pw"))
        for method, url in (
            ("post", reverse("minister-list")),
            ("patch", reverse("minister-detail", args=[self.minister_a.pk])),
            ("delete", reverse("minister-detail", args=[self.minister_a.pk])),
        ):
            response = getattr(self.client, method)(url, {"name": "Changed", "branch": self.alpha.pk}, format="json")
            self.assertEqual(response.status_code, 405, (method, url))
        self.assertTrue(Minister.objects.filter(pk=self.minister_a.pk, name="Banda").exists())


class MinisterTests(PeopleTestCase):
    def test_adds_edits_and_deletes_a_minister(self):
        response = self.client.post(list_url("alpha", "ministers"), {
            "name": "Mwale", "bio": "First paragraph.\n\nSecond.", "order": 2, "branch": self.beta.pk,
        }, format="json")
        self.assertEqual(response.status_code, 201)
        minister = Minister.objects.get(pk=response.data["id"])
        self.assertEqual((minister.branch, minister.order), (self.alpha, 2))
        self.client.patch(detail_url("alpha", "ministers", minister.pk), {"name": "Mwale-Phiri"}, format="json")
        minister.refresh_from_db()
        self.assertEqual(minister.name, "Mwale-Phiri")
        self.assertEqual(self.client.delete(detail_url("alpha", "ministers", minister.pk)).status_code, 204)
        self.assertFalse(Minister.objects.filter(pk=minister.pk).exists())

    def test_name_is_required(self):
        response = self.client.post(list_url("alpha", "ministers"), {"name": " "}, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertIn("name", response.data)

    def test_long_bio_and_order_are_refused(self):
        response = self.client.patch(detail_url("alpha", "ministers", self.minister_a.pk), {"bio": "x" * 5001}, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertIn("bio", response.data)
        for order in (-1, 1000):
            response = self.client.patch(detail_url("alpha", "ministers", self.minister_a.pk), {"order": order}, format="json")
            self.assertEqual(response.status_code, 400, order)
            self.assertIn("order", response.data)

    def test_photo_cannot_be_set_as_text(self):
        self.client.patch(detail_url("alpha", "ministers", self.minister_a.pk), {"photo": "ministers/elsewhere.webp"},
                          format="json")
        self.minister_a.refresh_from_db()
        self.assertEqual(self.minister_a.photo.name, "")

    def test_order_decides_who_comes_first_publicly(self):
        first = Minister.objects.create(branch=self.alpha, name="Zulu", order=0)
        Minister.objects.filter(pk=self.minister_a.pk).update(order=1)
        self.client.force_authenticate(None)
        response = self.client.get(reverse("minister-list"), {"branch": "alpha"})
        self.assertEqual(self.ids(response), [first.pk, self.minister_a.pk])

    def test_same_order_falls_back_to_name(self):
        Minister.objects.create(branch=self.alpha, name="Aaron")
        names = [row["name"] for row in self.client.get(list_url("alpha", "ministers")).data["results"]]
        self.assertEqual(names, ["Aaron", "Banda"])

    def test_minister_with_daily_messages_cannot_be_deleted(self):
        DailyMessage.objects.create(minister=self.minister_a, title="Word", message="m", date=date(2026, 1, 1))
        response = self.client.delete(detail_url("alpha", "ministers", self.minister_a.pk))
        self.assertEqual(response.status_code, 409)
        self.assertIn("daily messages", response.data["detail"])
        self.assertTrue(Minister.objects.filter(pk=self.minister_a.pk).exists())
        self.assertEqual(DailyMessage.objects.count(), 1)


@override_settings(STORAGES=IN_MEMORY)
class MinisterPhotoTests(PeopleTestCase):
    def upload(self, image=None, pk=None):
        return self.client.post(photo_url("alpha", pk or self.minister_a.pk), {"image": image or picture()},
                                format="multipart")

    def test_upload_saves_a_clean_smaller_copy(self):
        response = self.upload(picture(size=(3000, 2000)))
        self.assertEqual(response.status_code, 200)
        self.minister_a.refresh_from_db()
        name = self.minister_a.photo.name
        self.assertRegex(name, r"^ministers/[0-9a-f]{32}\.webp$")
        self.assertTrue(response.data["url"].endswith(name))
        with default_storage.open(name) as stored, Image.open(stored) as image:
            self.assertEqual(image.format, "WEBP")
            self.assertEqual(max(image.size), MINISTER_PHOTO_SIDE)

    def test_new_photo_replaces_and_deletes_the_old_one(self):
        self.upload()
        self.minister_a.refresh_from_db()
        old = self.minister_a.photo.name
        self.upload()
        self.minister_a.refresh_from_db()
        self.assertNotEqual(self.minister_a.photo.name, old)
        self.assertFalse(default_storage.exists(old))

    def test_remove_clears_and_deletes_the_photo(self):
        self.upload()
        self.minister_a.refresh_from_db()
        name = self.minister_a.photo.name
        response = self.client.delete(photo_url("alpha", self.minister_a.pk))
        self.assertEqual(response.status_code, 200)
        self.minister_a.refresh_from_db()
        self.assertEqual(self.minister_a.photo.name, "")
        self.assertFalse(default_storage.exists(name))

    def test_not_a_photo_is_refused(self):
        fake = SimpleUploadedFile("photo.jpg", b"not really a photo", content_type="image/jpeg")
        response = self.upload(fake)
        self.assertEqual(response.status_code, 400)
        self.assertIn("image", response.data)
        self.minister_a.refresh_from_db()
        self.assertEqual(self.minister_a.photo.name, "")

    def test_missing_file_is_refused(self):
        response = self.client.post(photo_url("alpha", self.minister_a.pk), {}, format="multipart")
        self.assertEqual(response.status_code, 400)
        self.assertIn("image", response.data)

    def test_deleting_a_minister_deletes_their_photo(self):
        self.upload()
        self.minister_a.refresh_from_db()
        name = self.minister_a.photo.name
        self.assertEqual(self.client.delete(detail_url("alpha", "ministers", self.minister_a.pk)).status_code, 204)
        self.assertFalse(default_storage.exists(name))

    def test_photo_cannot_skip_the_checks_through_the_edit_form(self):
        self.client.patch(detail_url("alpha", "ministers", self.minister_a.pk), {"photo": picture()}, format="multipart")
        self.minister_a.refresh_from_db()
        self.assertEqual(self.minister_a.photo.name, "")

    def test_photo_is_listed_as_a_link(self):
        self.upload()
        row = self.client.get(list_url("alpha", "ministers")).data["results"][0]
        self.assertTrue(row["photo"].startswith("http"))


class ServiceTimeTests(PeopleTestCase):
    def add(self, **fields):
        payload = {"day": "Every Wednesday", "title": "Prayer meeting", "start_time": "18:00", "end_time": "19:00",
                   **fields}
        return self.client.post(list_url("alpha", "services"), payload, format="json")

    def test_adds_edits_and_deletes_a_service(self):
        response = self.add(location="Hall", details="Prayer · Praise", order=1)
        self.assertEqual(response.status_code, 201)
        service = ServiceTime.objects.get(pk=response.data["id"])
        self.assertEqual((service.branch, service.location, service.order), (self.alpha, "Hall", 1))
        self.client.patch(detail_url("alpha", "services", service.pk), {"title": "Prayer night"}, format="json")
        service.refresh_from_db()
        self.assertEqual(service.title, "Prayer night")
        self.assertEqual(self.client.delete(detail_url("alpha", "services", service.pk)).status_code, 204)
        self.assertFalse(ServiceTime.objects.filter(pk=service.pk).exists())

    def test_required_fields(self):
        response = self.client.post(list_url("alpha", "services"), {}, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(set(response.data), {"day", "title", "start_time", "end_time"})

    def test_end_must_be_after_start(self):
        for end in ("18:00", "17:30"):
            response = self.add(end_time=end)
            self.assertEqual(response.status_code, 400, end)
            self.assertIn("end_time", response.data)
        response = self.client.patch(detail_url("alpha", "services", self.service_a.pk), {"end_time": "08:00"},
                                     format="json")
        self.assertIn("end_time", response.data)

    def test_order_must_be_sensible(self):
        for order in (-1, 1000):
            response = self.add(order=order)
            self.assertEqual(response.status_code, 400, order)
            self.assertIn("order", response.data)

    def test_listed_in_page_order(self):
        early = ServiceTime.objects.create(branch=self.alpha, day="Every Sunday", title="Early", start_time=time(7),
                                           end_time=time(8), order=0)
        late = ServiceTime.objects.create(branch=self.alpha, day="Every Friday", title="Youth", start_time=time(17),
                                          end_time=time(18), order=5)
        self.assertEqual(self.ids(self.client.get(list_url("alpha", "services"))), [early.pk, self.service_a.pk, late.pk])

    def test_new_service_shows_on_the_branch(self):
        self.add(title="Prayer meeting")
        self.client.force_authenticate(None)
        response = self.client.get(reverse("branch-detail", args=["alpha"]))
        self.assertIn("Prayer meeting", [s["title"] for s in response.data["service_times"]])
