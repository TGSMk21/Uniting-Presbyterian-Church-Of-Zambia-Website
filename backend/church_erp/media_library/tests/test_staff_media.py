"""The media library from the dashboard (AGENT_EXECUTION_PLAN.md, Task 5.3).

Staff keep their branch's photos, documents and recordings at
/api/staff/<branch>/media/. Files stay in the private bucket and are only
reached through signed links that expire."""
import io
import zipfile

from django.conf import settings
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.files.storage import storages
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.urls import reverse
from PIL import Image
from rest_framework.test import APITestCase

from church_erp.accounts.models import User
from church_erp.core.tests.helpers import make_branch
from church_erp.media_library.models import MediaAsset, MediaTag
from church_erp.media_library.uploads import LIBRARY_PHOTO_SIDE, MAX_BYTES, checked_upload

IN_MEMORY = {
    **settings.STORAGES,
    "default": {"BACKEND": "django.core.files.storage.InMemoryStorage"},
    "private": {"BACKEND": "django.core.files.storage.InMemoryStorage"},
}


def staff(username, branch=None, role="content_editor"):
    return User.objects.create_user(username, password="pw", is_staff=True, branch=branch, role=role)


def list_url(scope):
    return reverse("staff-media-list", args=[scope])


def detail_url(scope, pk):
    return reverse("staff-media-detail", args=[scope, pk])


def photo(name="easter.jpg", size=(40, 30), fmt="JPEG", exif=None):
    data = io.BytesIO()
    image = Image.new("RGB", size, "red")
    kwargs = {"exif": exif} if exif is not None else {}
    image.save(data, fmt, **kwargs)
    return SimpleUploadedFile(name, data.getvalue(), content_type="image/jpeg")


def office(name, folder):
    data = io.BytesIO()
    with zipfile.ZipFile(data, "w") as archive:
        archive.writestr("[Content_Types].xml", "<Types/>")
        archive.writestr(f"{folder}/document.xml", "<doc/>")
    return SimpleUploadedFile(name, data.getvalue())


def pdf(name="minutes.pdf"):
    return SimpleUploadedFile(name, b"%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF\n", content_type="application/pdf")


class MediaTestCase(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.alpha = make_branch("alpha")
        cls.beta = make_branch("beta")
        cls.editor = staff("editor", cls.alpha)

    def setUp(self):
        override = override_settings(STORAGES=IN_MEMORY)
        override.enable()
        self.addCleanup(override.disable)
        # FileField resolves a storage callable once, at import; point it at the new one.
        field = MediaAsset._meta.get_field("file")
        original = field.storage
        field.storage = storages["private"]
        self.addCleanup(setattr, field, "storage", original)
        self.private = field.storage
        self.client.force_authenticate(self.editor)

    def upload(self, file, scope="alpha", **fields):
        return self.client.post(list_url(scope), {"file": file, **fields}, format="multipart")

    def stored(self, response):
        asset = MediaAsset.objects.get(pk=response.data["id"])
        return asset, self.private.open(asset.file.name).read()

    def ids(self, response):
        return [row["id"] for row in response.data["results"]]


class AccessTests(MediaTestCase):
    def test_signed_out_is_refused(self):
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(list_url("alpha")).status_code, 401)

    def test_other_branch_is_refused(self):
        self.assertEqual(self.client.get(list_url("beta")).status_code, 403)
        self.assertEqual(self.upload(pdf(), scope="beta").status_code, 403)
        self.assertFalse(MediaAsset.objects.exists())

    def test_roles_without_content_rights_are_refused(self):
        self.client.force_authenticate(staff("treasurer", self.alpha, role="finance_admin"))
        self.assertEqual(self.client.get(list_url("alpha")).status_code, 403)

    def test_other_branchs_file_is_not_found(self):
        theirs = MediaAsset.objects.create(branch=self.beta, file="media_library/x.pdf", file_type="document", title="X")
        for method in ("get", "patch", "delete"):
            self.assertEqual(getattr(self.client, method)(detail_url("alpha", theirs.pk)).status_code, 404, method)
        self.assertTrue(MediaAsset.objects.filter(pk=theirs.pk).exists())

    def test_old_public_address_is_read_only(self):
        # Uploads there skipped every check below, so it only lists now.
        response = self.client.post(
            reverse("mediaasset-list"), {"file": pdf(), "title": "x", "file_type": "document", "branch": self.alpha.pk},
            format="multipart",
        )
        self.assertEqual(response.status_code, 405)


class UploadTests(MediaTestCase):
    def test_photo_is_saved_again_without_hidden_data(self):
        exif = Image.Exif()
        exif[0x010F] = "Phone maker"  # stands in for the location a phone records
        response = self.upload(photo(exif=exif.tobytes()))
        self.assertEqual(response.status_code, 201, response.data)
        asset, content = self.stored(response)
        self.assertEqual(asset.file_type, "image")
        self.assertTrue(asset.file.name.startswith("media_library/"))
        self.assertTrue(asset.file.name.endswith(".webp"))
        self.assertNotIn("easter", asset.file.name)
        with Image.open(io.BytesIO(content)) as saved:
            self.assertEqual(saved.format, "WEBP")
            self.assertFalse(saved.getexif())

    def test_large_photos_are_made_smaller(self):
        response = self.upload(photo(size=(LIBRARY_PHOTO_SIDE + 400, 100)))
        _, content = self.stored(response)
        with Image.open(io.BytesIO(content)) as saved:
            # The website makes photos this size first too (Utilities/mediaLibrary.mjs).
            self.assertEqual(saved.width, 2560)

    def test_documents_are_kept_as_they_are(self):
        file = pdf()
        response = self.upload(file)
        self.assertEqual(response.status_code, 201, response.data)
        asset, content = self.stored(response)
        self.assertEqual(asset.file_type, "document")
        self.assertTrue(asset.file.name.endswith(".pdf"))
        self.assertTrue(content.startswith(b"%PDF-"))

    def test_office_files_are_recognised_by_what_is_inside(self):
        for name, folder, ending in (
            ("plan.docx", "word", ".docx"), ("budget.xlsx", "xl", ".xlsx"), ("talk.pptx", "ppt", ".pptx"),
        ):
            response = self.upload(office(name, folder))
            self.assertEqual(response.status_code, 201, name)
            asset, _ = self.stored(response)
            self.assertEqual(asset.file_type, "document")
            self.assertTrue(asset.file.name.endswith(ending), name)
        # A zip that isn't an Office file is refused, whatever it's called.
        response = self.upload(office("plan.docx", "other"))
        self.assertEqual(response.status_code, 400)
        # So is one with Office's folders but not its contents list.
        data = io.BytesIO()
        with zipfile.ZipFile(data, "w") as archive:
            archive.writestr("word/document.xml", "<doc/>")
        self.assertEqual(self.upload(SimpleUploadedFile("plan.docx", data.getvalue())).status_code, 400)

    def test_recordings(self):
        mp3 = SimpleUploadedFile("hymn.mp3", b"ID3\x04\x00\x00\x00\x00\x00\x00" + b"\x00" * 64)
        frames = SimpleUploadedFile("hymn2.mp3", b"\xff\xfb\x90\x64" + b"\x00" * 64)
        m4a = SimpleUploadedFile("talk.m4a", b"\x00\x00\x00\x20ftypM4A \x00\x00\x00\x00" + b"\x00" * 64)
        for file, ending in ((mp3, ".mp3"), (frames, ".mp3"), (m4a, ".m4a")):
            response = self.upload(file)
            self.assertEqual(response.status_code, 201, file.name)
            asset, _ = self.stored(response)
            self.assertEqual(asset.file_type, "audio")
            self.assertTrue(asset.file.name.endswith(ending), file.name)

    def test_videos_are_sent_to_youtube(self):
        video = SimpleUploadedFile("service.mp4", b"\x00\x00\x00\x20ftypisom\x00\x00\x00\x00" + b"\x00" * 64)
        response = self.upload(video)
        self.assertEqual(response.status_code, 400)
        self.assertIn("YouTube", " ".join(response.data["file"]))

    def test_other_files_are_refused_whatever_their_name(self):
        for file in (
            SimpleUploadedFile("page.pdf", b"<html><script>alert(1)</script></html>"),
            SimpleUploadedFile("photo.jpg", b"MZ\x90\x00 not a photo"),
            SimpleUploadedFile("notes.txt", b"plain words"),
        ):
            response = self.upload(file)
            self.assertEqual(response.status_code, 400, file.name)
            self.assertIn("file", response.data)
        self.assertFalse(MediaAsset.objects.exists())

    def test_empty_and_missing_files_are_refused(self):
        self.assertEqual(self.upload(SimpleUploadedFile("empty.pdf", b"")).status_code, 400)
        response = self.client.post(list_url("alpha"), {"title": "No file"}, format="multipart")
        self.assertEqual(response.status_code, 400)
        self.assertIn("file", response.data)

    def test_the_checks_refuse_empty_files_themselves(self):
        # The API refuses them before this too; the checks shouldn't rely on that.
        with self.assertRaises(DjangoValidationError) as refused:
            checked_upload(SimpleUploadedFile("empty.pdf", b""))
        self.assertEqual(refused.exception.messages, ["This file is empty."])

    def test_size_is_limited(self):
        big = SimpleUploadedFile("big.pdf", b"%PDF-" + b"0" * MAX_BYTES)
        response = self.upload(big)
        self.assertEqual(response.status_code, 400)
        self.assertIn("4 MB", " ".join(response.data["file"]))
        exact = SimpleUploadedFile("exact.pdf", b"%PDF-" + b"0" * (MAX_BYTES - 5))
        self.assertEqual(self.upload(exact).status_code, 201)

    def test_title_defaults_to_the_file_name(self):
        response = self.upload(pdf("Church council minutes.pdf"))
        self.assertEqual(response.data["title"], "Church council minutes")
        response = self.upload(pdf(), title="  March minutes ", description="Signed copy")
        self.assertEqual(response.data["title"], "March minutes")
        self.assertEqual(response.data["description"], "Signed copy")

    def test_branch_type_and_uploader_are_set_by_the_server(self):
        response = self.upload(pdf(), branch=self.beta.pk, file_type="image", uploaded_by=999)
        asset, _ = self.stored(response)
        self.assertEqual(asset.branch, self.alpha)
        self.assertEqual(asset.file_type, "document")
        self.assertEqual(asset.uploaded_by, self.editor)
        self.assertEqual(response.data["uploaded_by_name"], "editor")

    def test_tags_are_typed_with_commas(self):
        MediaTag.objects.create(name="Easter")
        response = self.upload(pdf(), tags="easter, Youth ,, youth")
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(sorted(response.data["tags"]), ["Easter", "Youth"])
        self.assertEqual(MediaTag.objects.filter(name__iexact="easter").count(), 1)

    def test_tag_limits(self):
        response = self.upload(pdf(), tags="x" * 101)
        self.assertEqual(response.status_code, 400)
        self.assertIn("tags", response.data)
        response = self.upload(pdf(), tags=",".join(f"t{n}" for n in range(11)))
        self.assertEqual(response.status_code, 400)
        self.assertFalse(MediaAsset.objects.exists())

    def test_text_limits(self):
        self.assertEqual(self.upload(pdf(), title="x" * 201).status_code, 400)
        self.assertEqual(self.upload(pdf(), description="x" * 2001).status_code, 400)
        self.assertEqual(self.upload(pdf(), title="x" * 200, description="x" * 2000).status_code, 201)

    def test_a_refused_save_leaves_no_file_behind(self):
        response = self.upload(pdf(), title="x" * 201)
        self.assertEqual(response.status_code, 400)
        self.assertFalse(self.private.exists("media_library"))


class ListAndEditTests(MediaTestCase):
    def setUp(self):
        super().setUp()
        self.minutes = self.stored(self.upload(pdf("Minutes.pdf"), tags="Council"))[0]
        self.easter = self.stored(self.upload(photo(), title="Easter morning", tags="Easter, Youth"))[0]
        MediaAsset.objects.create(branch=self.beta, file="media_library/x.pdf", file_type="document", title="Theirs")

    def test_lists_own_branch_newest_first(self):
        self.assertEqual(self.ids(self.client.get(list_url("alpha"))), [self.easter.pk, self.minutes.pk])

    def test_filters(self):
        get = lambda **q: self.ids(self.client.get(list_url("alpha"), q))  # noqa: E731
        self.assertEqual(get(type="document"), [self.minutes.pk])
        self.assertEqual(get(type="image"), [self.easter.pk])
        self.assertEqual(get(tag="youth"), [self.easter.pk])
        self.assertEqual(get(q="morning"), [self.easter.pk])
        self.assertEqual(get(q="nothing like it"), [])
        MediaAsset.objects.filter(pk=self.minutes.pk).update(description="Signed by the session clerk")
        self.assertEqual(get(q="clerk"), [self.minutes.pk])

    def test_lists_only_tags_used_by_this_branch(self):
        theirs = MediaAsset.objects.get(title="Theirs")
        theirs.tags.add(MediaTag.objects.create(name="Secret plans"))
        response = self.client.get(reverse("staff-media-tags", args=["alpha"]))
        self.assertEqual(response.data, ["Council", "Easter", "Youth"])

    def test_rows_carry_a_link_to_open_the_file(self):
        row = self.client.get(detail_url("alpha", self.minutes.pk)).data
        self.assertEqual(row["url"], "http://testserver" + self.private.url(self.minutes.file.name))
        self.assertEqual(row["kind"], "PDF")
        self.assertEqual(row["file_type"], "document")

    def test_wording_and_tags_can_change_but_not_the_file(self):
        name = self.minutes.file.name
        response = self.client.patch(
            detail_url("alpha", self.minutes.pk),
            {"title": "April minutes", "description": "Draft", "tags": "Council, Finance", "file_type": "image"},
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.minutes.refresh_from_db()
        self.assertEqual(self.minutes.title, "April minutes")
        self.assertEqual(self.minutes.file.name, name)
        self.assertEqual(self.minutes.file_type, "document")
        self.assertEqual(sorted(t.name for t in self.minutes.tags.all()), ["Council", "Finance"])
        # Leaving tags out keeps them.
        self.client.patch(detail_url("alpha", self.minutes.pk), {"title": "Again"}, format="json")
        self.assertEqual(self.minutes.tags.count(), 2)
        # An empty box clears them.
        self.client.patch(detail_url("alpha", self.minutes.pk), {"tags": ""}, format="json")
        self.assertEqual(self.minutes.tags.count(), 0)

    def test_the_file_cannot_be_swapped_by_an_edit(self):
        name = self.minutes.file.name
        sneaky = SimpleUploadedFile("page.html", b"<script>alert(1)</script>", content_type="text/html")
        response = self.client.patch(
            detail_url("alpha", self.minutes.pk), {"file": sneaky, "title": "Same"}, format="multipart",
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.minutes.refresh_from_db()
        self.assertEqual(self.minutes.file.name, name)
        self.assertTrue(self.private.open(name).read().startswith(b"%PDF-"))

    def test_title_cannot_be_emptied(self):
        response = self.client.patch(detail_url("alpha", self.minutes.pk), {"title": " "}, format="json")
        self.assertEqual(response.status_code, 400)

    def test_delete_removes_the_file_too(self):
        name = self.minutes.file.name
        self.assertTrue(self.private.exists(name))
        self.assertEqual(self.client.delete(detail_url("alpha", self.minutes.pk)).status_code, 204)
        self.assertFalse(MediaAsset.objects.filter(pk=self.minutes.pk).exists())
        self.assertFalse(self.private.exists(name))
