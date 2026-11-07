"""Uploading page images from the dashboard (AGENT_EXECUTION_PLAN.md, Task 5.2)."""
import io
from pathlib import Path
from unittest import mock

from django.conf import settings
from django.core.cache import cache
from django.core.files.storage import default_storage
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import SimpleTestCase, override_settings
from django.urls import reverse
from PIL import Image
from rest_framework.test import APITestCase

from church_erp.accounts.models import User
from church_erp.content.models import PageContent
from church_erp.content.page_content import SCHEMA, field_specs
from church_erp.content.page_images import MAX_BYTES, MAX_PIXELS
from church_erp.core.models import Branch
from church_erp.core.tests.helpers import make_branch

PUBLIC_FOLDER = Path(__file__).resolve().parents[4] / "presbyterian-web" / "public"
IN_MEMORY = {**settings.STORAGES, "default": {"BACKEND": "django.core.files.storage.InMemoryStorage"}}


def picture(fmt="JPEG", size=(40, 30), mode="RGB", colour="red", name=None, **options):
    data = io.BytesIO()
    Image.new(mode, size, colour).save(data, fmt, **options)
    return SimpleUploadedFile(name or f"photo.{fmt.lower()}", data.getvalue(), content_type=f"image/{fmt.lower()}")


def staff(username, branch=None, role="content_editor"):
    return User.objects.create_user(username, password="pw", is_staff=True, branch=branch, role=role)


def image_specs():
    return [
        (kind, page, spec)
        for kind, pages in SCHEMA.items()
        for page in pages
        for spec in field_specs(kind, page).values()
        if spec["type"] == "image"
    ]


class ImageSchemaTests(SimpleTestCase):
    def test_there_are_image_fields_for_both_the_national_site_and_branches(self):
        kinds = {kind for kind, _, _ in image_specs()}
        self.assertEqual(kinds, {"national", "branch"})

    def test_original_images_exist_on_the_website(self):
        for kind, page, spec in image_specs():
            if spec["default"]:
                with self.subTest(key=spec["key"]):
                    self.assertTrue((PUBLIC_FOLDER / spec["default"].lstrip("/")).is_file())

    def test_images_stored_on_the_branch_have_a_column_there(self):
        for kind, page, spec in image_specs():
            if spec.get("store") == "branch":
                with self.subTest(key=spec["key"]):
                    self.assertEqual(Branch._meta.get_field(spec["key"]).get_internal_type(), "FileField")


@override_settings(STORAGES=IN_MEMORY)
class PageImageTestCase(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.alpha = make_branch("alpha")
        cls.beta = make_branch("beta")
        cls.editor = staff("editor", cls.alpha)
        cls.manager = staff("manager", cls.alpha, "branch_admin")
        cls.other = staff("other", cls.beta)
        cls.treasurer = staff("treasurer", cls.alpha, "finance_admin")
        cls.national = staff("national", None, "super_admin")
        cls.root = User.objects.create_superuser("root", password="pw")

    def setUp(self):
        cache.clear()
        self.addCleanup(cache.clear)

    def url(self, scope="alpha", page="home", key="hero_image"):
        return reverse("page-image", args=[scope, page, key])

    def upload(self, user, image=None, scope="alpha", page="home", key="hero_image"):
        self.client.force_authenticate(user)
        return self.client.post(self.url(scope, page, key), {"image": image or picture()}, format="multipart")

    def remove(self, user, scope="alpha", page="home", key="hero_image"):
        self.client.force_authenticate(user)
        return self.client.delete(self.url(scope, page, key))

    def stored_hero(self):
        self.alpha.refresh_from_db()
        return self.alpha.hero_image.name

    def stored_national(self, key="youth_image"):
        row = PageContent.objects.filter(branch=None, page="home").first()
        return row.fields.get(key) if row else None


class WhoCanUploadTests(PageImageTestCase):
    def test_signed_out_visitors_are_refused(self):
        response = self.client.post(self.url(), {"image": picture()}, format="multipart")
        self.assertEqual(response.status_code, 401)
        self.assertEqual(self.client.delete(self.url()).status_code, 401)
        self.assertEqual(self.stored_hero(), "")

    def test_branch_staff_can_upload_for_their_own_branch(self):
        for user in (self.editor, self.manager):
            with self.subTest(user=user.username):
                self.assertEqual(self.upload(user).status_code, 200)

    def test_staff_of_another_branch_are_refused(self):
        self.assertEqual(self.upload(self.other).status_code, 403)
        self.assertEqual(self.remove(self.other).status_code, 403)
        self.assertEqual(self.stored_hero(), "")

    def test_other_roles_at_the_branch_are_refused(self):
        self.assertEqual(self.upload(self.treasurer).status_code, 403)

    def test_branch_staff_cant_change_national_images(self):
        response = self.upload(self.manager, scope="national", key="youth_image")
        self.assertEqual(response.status_code, 403)
        self.assertIsNone(self.stored_national())

    def test_national_admins_can_change_national_images_but_not_a_branchs(self):
        self.assertEqual(self.upload(self.national, scope="national", key="youth_image").status_code, 200)
        self.assertEqual(self.upload(self.national).status_code, 403)

    def test_superusers_can_change_any(self):
        self.assertEqual(self.upload(self.root).status_code, 200)
        self.assertEqual(self.upload(self.root, scope="national", key="youth_image").status_code, 200)

    def test_a_refused_upload_stores_nothing(self):
        with mock.patch.object(default_storage, "save") as save:
            self.upload(self.other)
        save.assert_not_called()


class WhatCanBeUploadedTests(PageImageTestCase):
    def assert_refused(self, image, message):
        response = self.upload(self.editor, image)
        self.assertEqual(response.status_code, 400, response.data)
        self.assertIn(message, " ".join(response.data["image"]))
        self.assertEqual(self.stored_hero(), "")

    def test_only_image_fields_can_take_a_file(self):
        self.assertEqual(self.upload(self.editor, key="tagline").status_code, 404)
        self.assertEqual(self.upload(self.editor, key="nothing").status_code, 404)
        self.assertEqual(self.remove(self.editor, key="tagline").status_code, 404)

    def test_unknown_pages_and_branches_are_not_found(self):
        self.assertEqual(self.upload(self.root, page="nothing").status_code, 404)
        self.assertEqual(self.upload(self.root, scope="nowhere").status_code, 404)

    def test_a_file_is_required(self):
        self.client.force_authenticate(self.editor)
        response = self.client.post(self.url(), {}, format="multipart")
        self.assertEqual(response.status_code, 400)
        self.assertIn("image", response.data)

    def test_text_pretending_to_be_a_photo_is_refused(self):
        self.assert_refused(
            SimpleUploadedFile("photo.jpg", b"<script>alert(1)</script>", content_type="image/jpeg"),
            "JPG, PNG or WebP",
        )

    def test_svg_is_refused_because_it_can_carry_scripts(self):
        svg = b'<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'
        self.assert_refused(SimpleUploadedFile("logo.svg", svg, content_type="image/svg+xml"), "JPG, PNG or WebP")

    def test_other_image_formats_are_refused(self):
        self.assert_refused(picture("GIF", mode="P", colour=1), "JPG, PNG or WebP")
        self.assert_refused(picture("BMP"), "JPG, PNG or WebP")

    def test_a_damaged_photo_is_refused(self):
        whole = picture(size=(400, 300)).read()
        self.assert_refused(
            SimpleUploadedFile("photo.jpg", whole[: len(whole) // 2], content_type="image/jpeg"),
            "JPG, PNG or WebP",
        )

    def test_a_file_over_the_size_limit_is_refused(self):
        big = SimpleUploadedFile("photo.jpg", b"x" * (MAX_BYTES + 1), content_type="image/jpeg")
        self.assert_refused(big, "too large")

    def test_a_file_at_the_size_limit_is_read(self):
        image = picture(size=(10, 10))
        padded = SimpleUploadedFile("photo.jpg", image.read().ljust(MAX_BYTES, b"\0"), content_type="image/jpeg")
        self.assertEqual(self.upload(self.editor, padded).status_code, 200)

    def test_a_small_file_that_opens_into_a_huge_image_is_refused(self):
        with mock.patch("church_erp.content.page_images.MAX_PIXELS", 1000):
            self.assert_refused(picture(size=(40, 30)), "too large")

    def test_an_image_at_the_pixel_limit_is_read(self):
        with mock.patch("church_erp.content.page_images.MAX_PIXELS", 40 * 30):
            self.assertEqual(self.upload(self.editor, picture(size=(40, 30))).status_code, 200)

    def test_the_pixel_limit_stays_low_enough_for_the_servers_memory(self):
        self.assertLessEqual(MAX_PIXELS, 25_000_000)

    def test_a_decompression_bomb_is_refused(self):
        with mock.patch("PIL.Image.MAX_IMAGE_PIXELS", 10):  # Pillow's own guard trips when opening
            self.assert_refused(picture(size=(40, 30)), "too large")


class WhatGetsStoredTests(PageImageTestCase):
    def stored(self, name):
        return Image.open(default_storage.open(name))

    def test_uploads_are_saved_as_webp_under_a_new_name(self):
        self.upload(self.editor, picture(name="../../evil name.jpg"))
        name = self.stored_hero()
        self.assertRegex(name, r"^page_images/[0-9a-f]{32}\.webp$")
        self.assertEqual(self.stored(name).format, "WEBP")

    def test_every_format_allowed_is_read(self):
        for fmt in ("JPEG", "PNG", "WEBP"):
            with self.subTest(fmt=fmt):
                self.assertEqual(self.upload(self.editor, picture(fmt)).status_code, 200)

    def test_hidden_location_data_is_removed(self):
        exif = Image.Exif()
        exif[0x010E] = "Taken at the minister's house"
        exif.get_ifd(0x8825)[1] = "S"  # GPSLatitudeRef
        exif.get_ifd(0x8825)[2] = (15.0, 25.0, 0.0)  # GPSLatitude
        image = picture(size=(40, 30), exif=exif)
        self.assertTrue(Image.open(image).getexif())
        image.seek(0)

        self.upload(self.editor, image)

        stored = self.stored(self.stored_hero())
        self.assertFalse(stored.getexif())
        self.assertNotIn("exif", stored.info)
        self.assertNotIn(b"minister", default_storage.open(self.stored_hero()).read())

    def test_photos_taken_sideways_are_turned_upright(self):
        exif = Image.Exif()
        exif[0x0112] = 6  # rotate 90 degrees to display
        self.upload(self.editor, picture(size=(40, 30), exif=exif))
        self.assertEqual(self.stored(self.stored_hero()).size, (30, 40))

    def test_large_photos_are_shrunk_to_the_fields_longest_side(self):
        self.upload(self.editor, picture(size=(4000, 3000)))
        self.assertEqual(self.stored(self.stored_hero()).size, (2000, 1500))

    def test_small_photos_are_not_enlarged(self):
        self.upload(self.editor, picture(size=(40, 30)))
        self.assertEqual(self.stored(self.stored_hero()).size, (40, 30))

    def test_each_field_has_its_own_size(self):
        self.upload(self.editor, picture(size=(1000, 500)), key="logo")
        self.alpha.refresh_from_db()
        self.assertEqual(self.stored(self.alpha.logo.name).size, (600, 300))

    def test_logos_keep_their_transparent_background(self):
        self.upload(self.editor, picture("PNG", mode="RGBA", colour=(255, 0, 0, 0)), key="logo")
        self.alpha.refresh_from_db()
        stored = self.stored(self.alpha.logo.name).convert("RGBA")
        self.assertEqual(stored.getpixel((5, 5))[3], 0)

    def test_print_colour_photos_are_converted(self):
        self.assertEqual(self.upload(self.editor, picture(mode="CMYK", colour=(0, 0, 0, 0))).status_code, 200)
        self.assertEqual(self.stored(self.stored_hero()).mode, "RGB")


class WhereItShowsTests(PageImageTestCase):
    def test_branch_images_appear_in_the_branch_api_with_a_full_link(self):
        response = self.upload(self.editor)
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["url"].startswith("http"))
        self.client.force_authenticate(None)
        branch = self.client.get(reverse("branch-detail", args=[self.alpha.slug])).data
        self.assertEqual(branch["hero_image"], response.data["url"])

    def test_a_branch_logo_appears_in_the_branch_api(self):
        response = self.upload(self.editor, key="logo")
        self.client.force_authenticate(None)
        branch = self.client.get(reverse("branch-detail", args=[self.alpha.slug])).data
        self.assertEqual(branch["logo"], response.data["url"])

    def test_national_images_appear_in_the_public_page_content_as_links(self):
        response = self.upload(self.national, scope="national", key="youth_image")
        self.client.force_authenticate(None)
        pages = self.client.get(reverse("page-content", args=["national"])).data["pages"]
        self.assertEqual(pages["home"]["youth_image"], response.data["url"])
        self.assertTrue(pages["home"]["youth_image"].startswith("http"))

    def test_the_edit_form_gets_links_for_both_kinds(self):
        hero = self.upload(self.editor).data["url"]
        self.client.force_authenticate(self.editor)
        self.assertEqual(self.client.get(reverse("page-content-page", args=["alpha", "home"])).data["fields"]["hero_image"], hero)

        youth = self.upload(self.national, scope="national", key="youth_image").data["url"]
        self.client.force_authenticate(self.national)
        fields = self.client.get(reverse("page-content-page", args=["national", "home"])).data["fields"]
        self.assertEqual(fields["youth_image"], youth)

    def test_fields_without_a_custom_image_are_left_out_of_the_edit_form(self):
        self.client.force_authenticate(self.editor)
        fields = self.client.get(reverse("page-content-page", args=["alpha", "home"])).data["fields"]
        self.assertNotIn("hero_image", fields)
        self.assertNotIn("logo", fields)


class SavingWordingTests(PageImageTestCase):
    """Saving a page's wording mustn't touch its images."""

    def save_wording(self, user, scope, fields):
        self.client.force_authenticate(user)
        return self.client.put(reverse("page-content-page", args=[scope, "home"]), {"fields": fields}, format="json")

    def test_saving_wording_keeps_a_national_image(self):
        self.upload(self.national, scope="national", key="youth_image")
        name = self.stored_national()
        self.assertEqual(self.save_wording(self.national, "national", {"hero_text": "Hello"}).status_code, 200)
        self.assertEqual(self.stored_national(), name)
        self.assertEqual(self.stored_national("hero_text"), "Hello")

    def test_clearing_all_wording_keeps_a_national_image(self):
        self.upload(self.national, scope="national", key="youth_image")
        name = self.stored_national()
        self.assertEqual(self.save_wording(self.national, "national", {}).status_code, 200)
        self.assertEqual(self.stored_national(), name)

    def test_saving_wording_keeps_branch_images(self):
        self.upload(self.editor)
        name = self.stored_hero()
        self.assertEqual(self.save_wording(self.editor, "alpha", {"tagline": "Welcome"}).status_code, 200)
        self.assertEqual(self.stored_hero(), name)

    def test_the_save_answer_gives_links_not_storage_names(self):
        self.upload(self.national, scope="national", key="youth_image")
        response = self.save_wording(self.national, "national", {"hero_text": "Hello"})
        self.assertTrue(response.data["fields"]["youth_image"].startswith("http"))

    def test_image_fields_cant_be_set_as_text(self):
        # Otherwise a later replacement would delete whichever file this named.
        for scope, user, key in (("national", self.national, "youth_image"), ("alpha", self.editor, "hero_image")):
            with self.subTest(key=key):
                response = self.save_wording(user, scope, {key: "media_library/private.pdf"})
                self.assertEqual(response.status_code, 400)
                self.assertIn(key, response.data["fields"])
        self.assertIsNone(self.stored_national())
        self.assertEqual(self.stored_hero(), "")


class ReplacingAndRemovingTests(PageImageTestCase):
    def test_replacing_a_branch_image_deletes_the_old_file(self):
        self.upload(self.editor)
        first = self.stored_hero()
        self.upload(self.editor)
        second = self.stored_hero()
        self.assertNotEqual(first, second)
        self.assertFalse(default_storage.exists(first))
        self.assertTrue(default_storage.exists(second))

    def test_replacing_a_national_image_deletes_the_old_file(self):
        self.upload(self.national, scope="national", key="youth_image")
        first = self.stored_national()
        self.upload(self.national, scope="national", key="youth_image")
        self.assertFalse(default_storage.exists(first))
        self.assertTrue(default_storage.exists(self.stored_national()))

    def test_removing_a_branch_image_clears_it_and_deletes_the_file(self):
        self.upload(self.editor)
        name = self.stored_hero()
        response = self.remove(self.editor)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.stored_hero(), "")
        self.assertFalse(default_storage.exists(name))

    def test_removing_a_national_image_goes_back_to_the_original(self):
        self.upload(self.national, scope="national", key="youth_image")
        name = self.stored_national()
        response = self.remove(self.national, scope="national", key="youth_image")
        self.assertEqual(response.data["url"], "/youthMin.png")
        self.assertIsNone(self.stored_national())
        self.assertFalse(default_storage.exists(name))
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(reverse("page-content", args=["national"])).data["pages"], {})

    def test_removing_one_image_keeps_the_pages_other_changes(self):
        self.upload(self.national, scope="national", key="youth_image")
        self.upload(self.national, scope="national", key="men_image")
        men = self.stored_national("men_image")
        self.remove(self.national, scope="national", key="youth_image")
        self.assertEqual(self.stored_national("men_image"), men)
        self.assertTrue(default_storage.exists(men))

    def test_removing_when_there_is_nothing_to_remove_is_fine(self):
        self.assertEqual(self.remove(self.editor).status_code, 200)
        self.assertEqual(self.remove(self.national, scope="national", key="youth_image").status_code, 200)

    def test_a_failed_clean_up_doesnt_fail_the_upload(self):
        self.upload(self.editor)
        with mock.patch.object(default_storage, "delete", side_effect=OSError("storage is down")):
            with self.assertLogs("church_erp.content.page_images", level="ERROR"):
                response = self.upload(self.editor)
        self.assertEqual(response.status_code, 200)

    def test_if_the_record_cant_be_saved_the_new_file_is_removed(self):
        self.client.force_authenticate(self.editor)
        self.client.raise_request_exception = False
        with mock.patch("church_erp.content.page_images.set_image", side_effect=RuntimeError("database is down")):
            with mock.patch.object(default_storage, "delete") as delete:
                response = self.client.post(self.url(), {"image": picture()}, format="multipart")
        self.assertEqual(response.status_code, 500)
        delete.assert_called_once()
        self.assertEqual(self.stored_hero(), "")
