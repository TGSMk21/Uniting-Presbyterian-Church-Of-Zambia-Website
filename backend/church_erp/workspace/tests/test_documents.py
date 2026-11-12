"""The document hub (AGENT_EXECUTION_PLAN.md, Task 8.5): who can read, sharing, versions, the viewer."""
import io
import zipfile
from datetime import timedelta

from django.conf import settings
from django.core.cache import cache
from django.core.files.base import ContentFile
from django.core.files.storage import storages
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase

from church_erp.workspace.documents import readable_documents
from church_erp.workspace.models import (Deliverable, Document, DocumentShare, DocumentVersion, DocumentView,
                                         Meeting, MeetingAttendee, Notification)

from .helpers import appoint, build_synod

IN_MEMORY = {**settings.STORAGES, "private": {"BACKEND": "django.core.files.storage.InMemoryStorage"}}
DOCS = reverse("workspace-documents-list")
PDF = b"%PDF-1.4\n1 0 obj << >> endobj\ntrailer << >>\n%%EOF\n"


def url(document, name="detail"):
    return reverse(f"workspace-documents-{name}", args=[document.pk])


def docx(*paragraphs):
    body = "".join(paragraphs)
    xml = ('<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/'
           f'wordprocessingml/2006/main"><w:body>{body}</w:body></w:document>')
    data = io.BytesIO()
    with zipfile.ZipFile(data, "w") as archive:
        archive.writestr("[Content_Types].xml", "<Types/>")
        archive.writestr("word/document.xml", xml)
    return data.getvalue()


def para(text, style=None, bold=False):
    props = f'<w:pPr><w:pStyle w:val="{style}"/></w:pPr>' if style else ""
    run_props = "<w:rPr><w:b/></w:rPr>" if bold else ""
    return f"<w:p>{props}<w:r>{run_props}<w:t>{text}</w:t></w:r></w:p>"


class DocumentTestCase(APITestCase):
    def setUp(self):
        cache.clear()
        self.addCleanup(cache.clear)
        override = override_settings(STORAGES=IN_MEMORY)
        override.enable()
        self.addCleanup(override.disable)
        field = DocumentVersion._meta.get_field("file")
        original = field.storage
        field.storage = storages["private"]
        self.addCleanup(setattr, field, "storage", original)
        build_synod(self)

    def as_(self, user):
        self.client.force_authenticate(user)
        return self.client

    def doc(self, owner=None, title="Budget", text=None, content=PDF):
        owner = owner or self.elder
        if text is not None:
            document = Document.objects.create(title=title, kind="written", owner=owner)
            DocumentVersion.objects.create(document=document, number=1, file_type="written", text=text, author=owner)
        else:
            document = Document.objects.create(title=title, kind="uploaded", owner=owner)
            version = DocumentVersion(document=document, number=1, file_type="pdf", filename="budget.pdf",
                                      size=len(content), author=owner)
            version.file.save("budget.pdf", ContentFile(content), save=False)
            version.save()
        return document

    def share(self, document, kind, **target):
        return DocumentShare.objects.create(document=document, kind=kind, shared_by=document.owner, **target)

    def upload(self, user, content=PDF, name="report.pdf", **extra):
        body = {"title": "Report", "file": SimpleUploadedFile(name, content), **extra}
        return self.as_(user).post(DOCS, body, format="multipart")

    def meeting(self, organiser=None, attendees=(), **extra):
        organiser = organiser or self.minister
        meeting = Meeting.objects.create(title="Session meeting", level="branch", branch=self.a1,
                                         starts_at=timezone.now() + timedelta(days=5), organiser=organiser, **extra)
        for person in (organiser, *attendees):
            MeetingAttendee.objects.get_or_create(meeting=meeting, person=person)
        return meeting


class WhoCanReadTests(DocumentTestCase):
    """The one access rule, case by case (decision D8.6)."""

    def readers(self, document):
        people = [self.minister, self.elder, self.elder_a2, self.elder_b1, self.editor, self.root]
        return {p.username for p in people if readable_documents(p).filter(pk=document.pk).exists()}

    def test_only_the_owner_until_it_is_shared(self):
        self.assertEqual(self.readers(self.doc()), {"elder"})

    def test_the_superuser_does_not_read_others_documents(self):
        document = self.doc()
        self.assertEqual(self.as_(self.root).get(url(document)).status_code, 404)

    def test_one_person(self):
        document = self.doc()
        self.share(document, "person", person=self.elder_b1)
        self.assertEqual(self.readers(document), {"elder", "elder_b1"})

    def test_a_meetings_people(self):
        appoint(self.elder_a2, self.session_clerk, branch=self.a2)
        meeting = self.meeting(attendees=[self.elder_b1])
        document = self.doc(owner=self.minister)
        self.share(document, "meeting", meeting=meeting)
        # The superuser can see every meeting, but isn't on this one.
        self.assertEqual(self.readers(document), {"minister", "elder_b1"})
        appoint(self.elder, self.session_clerk, branch=self.a1)     # a fellow organiser at the meeting's branch
        self.assertEqual(self.readers(document), {"minister", "elder", "elder_b1"})

    def test_one_branch(self):
        document = self.doc()
        self.share(document, "branch", branch=self.a1)
        self.assertEqual(self.readers(document), {"minister", "elder"})

    def test_one_presbytery(self):
        document = self.doc()
        self.share(document, "presbytery", presbytery=self.north)
        self.assertEqual(self.readers(document), {"minister", "elder", "elder_a2"})

    def test_the_whole_synod(self):
        document = self.doc()
        self.share(document, "synod")
        self.assertEqual(self.readers(document), {"minister", "elder", "elder_a2", "elder_b1", "root"})

    def test_a_suspended_account_reads_nothing(self):
        document = self.doc()
        self.share(document, "person", person=self.elder_b1)
        self.elder_b1.is_active = False
        self.elder_b1.save()
        self.assertNotIn("elder_b1", self.readers(document))

    def test_every_address_follows_the_rule(self):
        document = self.doc()
        for name in ("detail", "file", "preview"):
            with self.subTest(name=name):
                self.assertEqual(self.as_(self.elder_a2).get(url(document, name)).status_code, 404)
        self.assertNotIn(document.pk, [d["id"] for d in self.as_(self.elder_a2).get(DOCS).data["results"]])
        self.assertEqual(self.as_(self.editor).get(DOCS).status_code, 403)


class SharingTests(DocumentTestCase):
    def share_via_api(self, user, document, **target):
        return self.as_(user).post(url(document, "shares"), {"add": [target]}, format="json")

    def test_sharing_with_a_person_tells_them(self):
        document = self.doc()
        response = self.share_via_api(self.elder, document, kind="person", person=self.elder_b1.pk)
        self.assertEqual(response.status_code, 200, response.data)
        note = Notification.objects.get(person=self.elder_b1)
        self.assertEqual((note.kind, note.link), ("document_shared", f"/dashboard/documents/{document.pk}"))

    def test_sharing_with_a_meeting_tells_its_people(self):
        meeting = self.meeting(attendees=[self.elder, self.elder_a2])
        document = self.doc()
        self.assertEqual(self.share_via_api(self.elder, document, kind="meeting", meeting=meeting.pk).status_code, 200)
        self.assertEqual(set(Notification.objects.values_list("person__username", flat=True)), {"minister", "elder_a2"})

    def test_groups_only_where_you_belong(self):
        document = self.doc()
        cases = [
            (dict(kind="branch", branch="a2"), 400), (dict(kind="presbytery", presbytery="south"), 400),
            (dict(kind="synod"), 400), (dict(kind="person", person=self.editor.pk), 400),
            (dict(kind="person", person=999999), 400), (dict(kind="nonsense"), 400),
            (dict(kind="branch", branch="a1"), 200), (dict(kind="presbytery", presbytery="north"), 200),
        ]
        for target, expected in cases:
            with self.subTest(target=target):
                self.assertEqual(self.share_via_api(self.elder, document, **target).status_code, expected)

    def test_synod_office_bearers_and_the_superuser_share_with_everyone(self):
        appoint(self.elder, self.synod_clerk)
        self.assertEqual(self.share_via_api(self.elder, self.doc(), kind="synod").status_code, 200)
        self.assertEqual(self.share_via_api(self.root, self.doc(owner=self.root), kind="synod").status_code, 200)
        self.assertEqual(self.share_via_api(self.root, self.doc(owner=self.root), kind="branch", branch="b1")
                         .status_code, 200)

    def test_a_meeting_you_cant_see_cant_be_shared_with(self):
        meeting = self.meeting()
        self.assertEqual(self.share_via_api(self.elder_b1, self.doc(owner=self.elder_b1), kind="meeting",
                                            meeting=meeting.pk).status_code, 400)

    def test_only_the_owner_shares_and_unshares(self):
        document = self.doc()
        share = self.share(document, "person", person=self.elder_a2)
        self.assertEqual(self.share_via_api(self.elder_a2, document, kind="person", person=self.minister.pk)
                         .status_code, 403)
        self.assertEqual(self.share_via_api(self.elder_b1, document, kind="person", person=self.minister.pk)
                         .status_code, 404)
        response = self.as_(self.elder).post(url(document, "shares"), {"remove": [share.pk]}, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertFalse(readable_documents(self.elder_a2).filter(pk=document.pk).exists())

    def test_sharing_twice_keeps_one_share(self):
        document = self.doc()
        self.share_via_api(self.elder, document, kind="branch", branch="a1")
        self.share_via_api(self.elder, document, kind="branch", branch="a1")
        self.assertEqual(document.shares.count(), 1)

    def test_owners_see_who_can_read_and_who_opened_it_readers_see_less(self):
        document = self.doc()
        self.share(document, "branch", branch=self.a1)
        self.as_(self.minister).get(url(document, "file"))
        mine = self.as_(self.elder).get(url(document)).data
        self.assertEqual(mine["shares"][0]["label"], "Everyone at A1")
        self.assertIn("id", mine["shares"][0])
        self.assertEqual([v["name"] for v in mine["viewers"]], ["Minister"])
        theirs = self.as_(self.minister).get(url(document)).data
        self.assertEqual(theirs["shared_with"], ["Everyone at A1"])
        self.assertNotIn("viewers", theirs)
        self.assertNotIn("shares", theirs)


class VersionTests(DocumentTestCase):
    def test_uploading_a_file(self):
        response = self.upload(self.elder, description="For the session")
        self.assertEqual(response.status_code, 201, response.data)
        document = Document.objects.get()
        self.assertEqual((document.owner, document.kind, document.current.number), (self.elder, "uploaded", 1))
        self.assertEqual((document.current.file_type, document.current.filename), ("pdf", "report.pdf"))

    def test_the_kind_of_file_is_read_from_inside_it(self):
        cases = [
            (b"MZ\x90\x00 an exe", "tool.pdf", 400), (bytes.fromhex("D0CF11E0A1B11AE1") + b"x" * 50, "old.doc", 400),
            (b"Plain words\nand more", "notes.txt", 201), (docx(para("Hi")), "letter.docx", 201),
            (b"x" * 4_000_001, "big.txt", 400), (b"", "empty.pdf", 400), (b"ID3\x03 song", "song.mp3", 400),
        ]
        for content, name, expected in cases:
            with self.subTest(name=name):
                self.assertEqual(self.upload(self.elder, content=content, name=name).status_code, expected)

    def test_an_older_office_file_gets_a_way_forward(self):
        response = self.upload(self.elder, content=bytes.fromhex("D0CF11E0A1B11AE1") + b"\x00" * 50, name="old.doc")
        self.assertEqual(response.status_code, 400)
        self.assertIn("older Office file", str(response.data))

    def test_a_binary_file_is_not_taken_for_text(self):
        self.assertEqual(self.upload(self.elder, content=b"abc\x00def", name="data.txt").status_code, 400)

    def test_writing_a_document_here(self):
        response = self.as_(self.elder).post(DOCS, {"title": "Notice", "text": "Dear all,\nWe meet on Friday."},
                                             format="json")
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(Document.objects.get().current.text, "Dear all,\nWe meet on Friday.")
        self.assertEqual(self.as_(self.elder).post(DOCS, {"title": "Empty"}, format="json").status_code, 400)

    def test_a_new_version_keeps_the_old_one(self):
        document = self.doc()
        body = {"file": SimpleUploadedFile("v2.pdf", PDF + b"% v2"), "note": "Fixed the totals"}
        response = self.as_(self.elder).post(url(document, "versions"), body, format="multipart")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual([(v.number, v.note) for v in document.versions.all()], [(2, "Fixed the totals"), (1, "")])
        old = self.as_(self.elder).get(url(document, "file") + "?version=1")
        self.assertEqual(b"".join(old.streaming_content), PDF)

    def test_written_documents_take_text_and_files_take_files(self):
        written = self.doc(text="First words")
        self.assertEqual(self.as_(self.elder).post(url(written, "versions"), {"text": "Better words"}, format="json")
                         .status_code, 200)
        self.assertEqual(written.current.text, "Better words")
        body = {"file": SimpleUploadedFile("x.pdf", PDF)}
        self.assertEqual(self.as_(self.elder).post(url(written, "versions"), body, format="multipart").status_code, 400)
        uploaded = self.doc()
        self.assertEqual(self.as_(self.elder).post(url(uploaded, "versions"), {"text": "x"}, format="json")
                         .status_code, 400)

    def test_restoring_an_old_version_makes_it_the_newest(self):
        document = self.doc(text="One")
        self.as_(self.elder).post(url(document, "versions"), {"text": "Two"}, format="json")
        response = self.as_(self.elder).post(url(document, "restore"), {"version": 1}, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        current = document.current
        self.assertEqual((current.number, current.text, current.note), (3, "One", "Restored version 1"))

    def test_only_the_owner_changes_it(self):
        document = self.doc()
        self.share(document, "person", person=self.elder_a2)
        attempts = [
            ("post", url(document, "versions"), {"text": "x"}), ("post", url(document, "restore"), {"version": 1}),
            ("patch", url(document), {"title": "Mine now"}), ("delete", url(document), None),
        ]
        for method, address, body in attempts:
            with self.subTest(address=address, method=method):
                self.assertEqual(getattr(self.as_(self.elder_a2), method)(address, body, format="json").status_code, 403)
        self.assertEqual(self.as_(self.elder).patch(url(document), {"title": "Budget 2027"}, format="json")
                         .status_code, 200)
        self.assertEqual(self.as_(self.elder).delete(url(document)).status_code, 204)
        self.assertFalse(Document.objects.exists())


class ViewerTests(DocumentTestCase):
    def test_the_file_comes_with_its_type_and_name(self):
        document = self.doc()
        response = self.as_(self.elder).get(url(document, "file"))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "application/pdf")
        self.assertIn('filename="budget.pdf"', response["Content-Disposition"])
        self.assertEqual(response["Cache-Control"], "private, no-store")
        self.assertEqual(response["X-Content-Type-Options"], "nosniff")

    def test_a_word_file_reads_as_headings_and_paragraphs(self):
        response = self.upload(self.elder, content=docx(para("Minutes", style="Heading1"),
                                                        para("Present: all", bold=True)), name="minutes.docx")
        document = Document.objects.get(pk=response.data["id"])
        blocks = self.as_(self.elder).get(url(document, "preview")).data["blocks"]
        self.assertEqual(blocks[0], {"type": "heading", "level": 1,
                                     "runs": [{"text": "Minutes", "b": False, "i": False, "u": False}]})
        self.assertEqual(blocks[1]["runs"][0], {"text": "Present: all", "b": True, "i": False, "u": False})

    def test_a_text_file_previews_as_its_words(self):
        response = self.upload(self.elder, content="Agenda: prayer – finance".encode(), name="agenda.txt")
        document = Document.objects.get(pk=response.data["id"])
        self.assertEqual(self.as_(self.elder).get(url(document, "preview")).data["text"], "Agenda: prayer – finance")

    def test_a_written_document_previews_as_its_text(self):
        document = self.doc(text="Dear all")
        self.assertEqual(self.as_(self.elder).get(url(document, "preview")).data["text"], "Dear all")

    def test_opening_it_is_noted_once_per_version_for_readers_only(self):
        document = self.doc()
        self.share(document, "branch", branch=self.a1)
        self.as_(self.minister).get(url(document, "file"))
        self.as_(self.minister).get(url(document, "preview"))
        self.as_(self.elder).get(url(document, "file"))
        self.assertEqual(list(DocumentView.objects.values_list("person__username", flat=True)), ["minister"])


class ListTests(DocumentTestCase):
    def test_mine_and_shared_with_me_and_search(self):
        mine = self.doc(title="Budget")
        theirs = self.doc(owner=self.minister, title="Minutes")
        self.share(theirs, "branch", branch=self.a1)
        client = self.as_(self.elder)
        ids = lambda query: [d["id"] for d in client.get(DOCS + query).data["results"]]  # noqa: E731
        self.assertEqual(ids("?view=mine"), [mine.pk])
        self.assertEqual(ids("?view=shared"), [theirs.pk])
        self.assertEqual(ids("?q=minu"), [theirs.pk])
        row = client.get(DOCS + "?view=shared").data["results"][0]
        self.assertEqual((row["owner"], row["seen"], row["shared_with"]), ("Minister", False, ["Everyone at A1"]))
        client.get(url(theirs, "file"))
        self.assertTrue(client.get(DOCS + "?view=shared").data["results"][0]["seen"])

    def test_the_overview_counts_documents_not_yet_opened(self):
        theirs = self.doc(owner=self.minister)
        self.share(theirs, "person", person=self.elder)
        self.assertEqual(self.as_(self.elder).get(reverse("workspace-attention")).data["unread_documents"], 1)
        self.as_(self.elder).get(url(theirs, "file"))
        self.assertEqual(self.as_(self.elder).get(reverse("workspace-attention")).data["unread_documents"], 0)


class MeetingDocumentTests(DocumentTestCase):
    def test_a_meeting_lists_documents_shared_with_it(self):
        meeting = self.meeting(attendees=[self.elder])
        document = self.doc()
        self.share(document, "meeting", meeting=meeting)
        data = self.as_(self.minister).get(reverse("workspace-meetings-detail", args=[meeting.pk])).data
        self.assertEqual([d["id"] for d in data["documents"]], [document.pk])

    def test_handing_in_a_deliverable_with_its_document(self):
        meeting = self.meeting(attendees=[self.elder])
        row = Deliverable.objects.create(meeting=meeting, title="Minutes", assignee=self.elder,
                                         due_on=timezone.localdate())
        document = self.doc()
        submit = reverse("workspace-deliverables-submit", args=[row.pk])
        response = self.as_(self.elder).post(submit, {"document": document.pk}, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        row.refresh_from_db()
        self.assertEqual(row.submitted_document, document)
        # The meeting's people can now read it, the organiser included.
        self.assertTrue(readable_documents(self.minister).filter(pk=document.pk).exists())
        self.assertEqual(response.data["document"], {"id": document.pk, "title": "Budget"})

    def test_only_your_own_document_can_be_handed_in(self):
        meeting = self.meeting(attendees=[self.elder])
        row = Deliverable.objects.create(meeting=meeting, title="Minutes", assignee=self.elder,
                                         due_on=timezone.localdate())
        theirs = self.doc(owner=self.minister)
        self.share(theirs, "person", person=self.elder)
        submit = reverse("workspace-deliverables-submit", args=[row.pk])
        self.assertEqual(self.as_(self.elder).post(submit, {"document": theirs.pk}, format="json").status_code, 400)


class ReviewFixTests(DocumentTestCase):
    """Findings from the code review (Task 8.6)."""

    def test_a_picture_keeps_its_name(self):
        from PIL import Image
        data = io.BytesIO()
        Image.new("RGB", (20, 20), "red").save(data, "PNG")
        response = self.upload(self.elder, content=data.getvalue(), name="church-photo.png")
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(Document.objects.get().current.filename, "church-photo.webp")

    def test_names_with_accents_download_as_they_are(self):
        document = self.doc()
        DocumentVersion.objects.filter(document=document).update(filename="Budget—Ŵ 2026.pdf")
        disposition = self.as_(self.elder).get(url(document, "file"))["Content-Disposition"]
        self.assertIn("filename*=utf-8''Budget%E2%80%94%C5%B4%202026.pdf", disposition)
        self.assertTrue(disposition.startswith("inline"))

    def test_the_document_list_stays_cheap(self):
        """The number of queries doesn't grow with the number of documents."""
        from django.db import connection
        from django.test.utils import CaptureQueriesContext

        def queries(count):
            for index in range(count):
                self.share(self.doc(owner=self.minister, title=f"Doc {index}"), "branch", branch=self.a1)
            self.as_(self.elder).get(DOCS)
            with CaptureQueriesContext(connection) as seen:
                self.as_(self.elder).get(DOCS)
            return len(seen)

        self.assertEqual(queries(2), queries(4))

    def test_a_newer_version_shows_as_new_again(self):
        theirs = self.doc(owner=self.minister)
        self.share(theirs, "branch", branch=self.a1)
        self.as_(self.elder).get(url(theirs, "file"))
        self.assertTrue(self.as_(self.elder).get(DOCS).data["results"][0]["seen"])
        body = {"file": SimpleUploadedFile("v2.pdf", PDF + b"% v2")}
        self.as_(self.minister).post(url(theirs, "versions"), body, format="multipart")
        self.assertFalse(self.as_(self.elder).get(DOCS).data["results"][0]["seen"])
