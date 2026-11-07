"""Written sermons from the dashboard (AGENT_EXECUTION_PLAN.md, Task 4.1).

Pastors' sermons are private: only their own branch's staff see them, at
/api/staff/<branch>/writings/. They're pasted in, or added as Word, PDF or
text files, and feed the daily message drafts."""
import shutil
import tempfile

from django.core.cache import cache
from django.core.files.storage import FileSystemStorage
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from rest_framework.test import APITestCase

from church_erp.accounts.models import User
from church_erp.ai_messages.models import SermonDocument, SermonEmbedding
from church_erp.core.models import Minister
from church_erp.core.tests.helpers import make_branch

from .files import docx_bytes, pdf_bytes

PRIVATE_ROOT = tempfile.mkdtemp(prefix="writings-test-")


def staff(username, branch=None, role="content_editor", **extra):
    return User.objects.create_user(username, password="pw", is_staff=True, branch=branch, role=role, **extra)


def list_url(scope):
    return reverse("staff-writings-list", args=[scope])


def detail_url(scope, pk):
    return reverse("staff-writings-detail", args=[scope, pk])


def upload_url(scope):
    return reverse("staff-writings-upload", args=[scope])


class WritingsTestCase(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.alpha = make_branch("alpha")
        cls.beta = make_branch("beta")
        cls.editor = staff("editor", cls.alpha)
        cls.minister_a = Minister.objects.create(branch=cls.alpha, name="Banda")
        cls.minister_b = Minister.objects.create(branch=cls.beta, name="Phiri")

    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        shutil.rmtree(PRIVATE_ROOT, ignore_errors=True)

    def setUp(self):
        cache.clear()
        self.addCleanup(cache.clear)
        self.client.force_authenticate(self.editor)
        # FileField picks its storage once, at import; use a throwaway folder here.
        field = SermonDocument._meta.get_field("source_file")
        original = field.storage
        self.storage = field.storage = FileSystemStorage(location=PRIVATE_ROOT)
        self.addCleanup(setattr, field, "storage", original)

    def document(self, minister=None, **extra):
        values = {"title": "Grace", "text": "Grace and peace to you.", **extra}
        return SermonDocument.objects.create(minister=minister or self.minister_a, **values)

    def send(self, data, name, **fields):
        return self.client.post(
            upload_url("alpha"),
            {"file": SimpleUploadedFile(name, data), "minister": self.minister_a.pk, **fields},
            format="multipart",
        )


class PastingTests(WritingsTestCase):
    def test_staff_paste_a_sermon_for_one_of_their_ministers(self):
        response = self.client.post(list_url("alpha"), {
            "minister": self.minister_a.pk, "title": "The Lost Sheep", "preached_on": "2026-10-04",
            "text": "Rejoice with me.\r\n\r\n\r\nFor I have found my sheep.  ",
        }, format="json")
        self.assertEqual(response.status_code, 201, response.data)
        document = SermonDocument.objects.get()
        self.assertEqual(document.text, "Rejoice with me.\n\nFor I have found my sheep.")
        self.assertEqual(document.uploaded_by, self.editor)
        self.assertEqual(response.data["minister_name"], "Banda")
        self.assertEqual(response.data["word_count"], 9)
        self.assertFalse(response.data["ready"])
        self.assertEqual(response.data["source_name"], "")

    def test_another_branchs_minister_cant_be_chosen(self):
        response = self.client.post(list_url("alpha"), {
            "minister": self.minister_b.pk, "title": "T", "text": "Words",
        }, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertIn("minister", response.data)
        self.assertFalse(SermonDocument.objects.exists())

    def test_empty_or_overlong_text_is_refused(self):
        for text in ("   \n ", "word " * 40100):
            with self.subTest(length=len(text)):
                response = self.client.post(list_url("alpha"), {
                    "minister": self.minister_a.pk, "title": "T", "text": text,
                }, format="json")
                self.assertEqual(response.status_code, 400)
                self.assertIn("text", response.data)

    def test_the_list_holds_only_this_branchs_sermons_without_their_full_text(self):
        mine = self.document()
        self.document(minister=self.minister_b, title="Not mine")
        response = self.client.get(list_url("alpha"))
        self.assertEqual([row["id"] for row in response.data["results"]], [mine.pk])
        self.assertNotIn("text", response.data["results"][0])
        self.assertEqual(self.client.get(detail_url("alpha", mine.pk)).data["text"], mine.text)

    def test_changing_the_words_means_they_are_read_again(self):
        document = self.document()
        SermonEmbedding.objects.create(document=document, chunk_index=0, chunk_text="x", embedding=[0.0] * 1536, model="m")
        self.client.patch(detail_url("alpha", document.pk), {"title": "New title"}, format="json")
        self.assertEqual(document.embeddings.count(), 1)
        response = self.client.patch(detail_url("alpha", document.pk), {"text": "Different words."}, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(document.embeddings.count(), 0)
        self.assertFalse(response.data["ready"])

    def test_the_export_leaves_out_the_full_text(self):
        self.document(text="Secret sermon words")
        response = self.client.get(reverse("staff-writings-export", args=["alpha"]))
        self.assertEqual(response.status_code, 200)
        body = response.content.decode("utf-8-sig")
        self.assertIn("Grace", body)
        self.assertNotIn("Secret sermon words", body)

    def test_changes_are_kept_in_the_history(self):
        self.client.post(list_url("alpha"), {"minister": self.minister_a.pk, "title": "Kept", "text": "W"}, format="json")
        from church_erp.core.models import StaffChange
        change = StaffChange.objects.get()
        self.assertEqual((change.section, change.action, change.target), ("writings", "added", "Kept"))


class UploadTests(WritingsTestCase):
    def test_a_word_file_becomes_a_sermon_titled_after_the_file(self):
        response = self.send(docx_bytes(["The Lord is my shepherd.", "I shall not want."]), "Psalm_23-sermon.docx")
        self.assertEqual(response.status_code, 201, response.data)
        document = SermonDocument.objects.get()
        self.assertEqual(document.title, "Psalm 23 sermon")
        self.assertEqual(document.text, "The Lord is my shepherd.\n\nI shall not want.")
        self.assertEqual((document.source_name, document.file_kind), ("Psalm_23-sermon.docx", "docx"))
        self.assertEqual(document.uploaded_by, self.editor)

    def test_the_file_is_kept_privately_under_a_name_we_choose(self):
        self.send(pdf_bytes(["Blessed are the meek."]), "../../etc/meek.pdf", title="Meekness", preached_on="2026-09-06")
        document = SermonDocument.objects.get()
        self.assertEqual(document.title, "Meekness")
        self.assertEqual(str(document.preached_on), "2026-09-06")
        self.assertTrue(document.source_file.name.startswith("sermon_documents/"))
        self.assertTrue(document.source_file.name.endswith(".pdf"))
        self.assertNotIn("meek", document.source_file.name)
        self.assertTrue(self.storage.exists(document.source_file.name))
        # The API never hands out a link to it.
        response = self.client.get(detail_url("alpha", document.pk))
        self.assertNotIn(document.source_file.name, str(response.data))

    def test_files_that_cant_be_read_are_refused_and_nothing_is_kept(self):
        response = self.send(pdf_bytes([]), "scan.pdf")
        self.assertEqual(response.status_code, 400)
        self.assertIn("scanned", " ".join(response.data["file"]))
        self.assertFalse(SermonDocument.objects.exists())

    def test_uploads_need_a_file_and_one_of_this_branchs_ministers(self):
        response = self.client.post(upload_url("alpha"), {"minister": self.minister_a.pk}, format="multipart")
        self.assertEqual(response.status_code, 400)
        self.assertIn("file", response.data)
        response = self.client.post(upload_url("alpha"), {
            "file": SimpleUploadedFile("a.txt", b"Words"), "minister": self.minister_b.pk,
        }, format="multipart")
        self.assertEqual(response.status_code, 400)
        self.assertIn("minister", response.data)
        self.assertFalse(SermonDocument.objects.exists())

    def test_deleting_a_sermon_deletes_its_file(self):
        self.send(b"Plain words.", "plain.txt")
        document = SermonDocument.objects.get()
        name = document.source_file.name
        self.assertEqual(self.client.delete(detail_url("alpha", document.pk)).status_code, 204)
        self.assertFalse(self.storage.exists(name))

    def test_other_branches_cant_upload_here(self):
        self.client.force_authenticate(staff("other", self.beta))
        self.assertEqual(self.send(b"Words", "a.txt").status_code, 403)


class MinisterWithSermonsTests(WritingsTestCase):
    def test_a_minister_with_written_sermons_cant_be_deleted(self):
        self.document()
        response = self.client.delete(reverse("staff-ministers-detail", args=["alpha", self.minister_a.pk]))
        self.assertEqual(response.status_code, 409)
        self.assertIn("written sermons", response.data["detail"])
        self.assertTrue(Minister.objects.filter(pk=self.minister_a.pk).exists())
