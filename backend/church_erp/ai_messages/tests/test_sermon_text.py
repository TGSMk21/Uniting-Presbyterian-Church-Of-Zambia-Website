"""Reading the words out of a pastor's sermon file (AGENT_EXECUTION_PLAN.md, Task 4.1).

The kind of file is decided by what's inside it, never by its name."""
import io
import zipfile

from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import SimpleTestCase

from church_erp.ai_messages import sermon_text
from church_erp.ai_messages.sermon_text import sermon_file_text

from .files import docx_bytes, pdf_bytes


def upload(data, name="sermon.bin"):
    return SimpleUploadedFile(name, data)


class SermonFileTextTests(SimpleTestCase):
    def refused(self, data, name="sermon.bin"):
        with self.assertRaises(ValidationError) as caught:
            sermon_file_text(upload(data, name))
        return " ".join(caught.exception.messages)

    def test_plain_text_in_utf8_with_or_without_a_marker(self):
        for data in ("Grace and peace — to you.\n\nAmen.".encode(), "\ufeffGrace and peace — to you.\n\nAmen.".encode()):
            with self.subTest(data=data[:3]):
                text, kind = sermon_file_text(upload(data, "notes.txt"))
                self.assertEqual(text, "Grace and peace — to you.\n\nAmen.")
                self.assertEqual(kind, "txt")

    def test_plain_text_saved_by_older_windows_programs(self):
        text, kind = sermon_file_text(upload("Café “quoted” words".encode("cp1252")))
        self.assertEqual(text, "Café “quoted” words")
        self.assertEqual(kind, "txt")

    def test_windows_line_endings_and_extra_blank_lines_are_tidied(self):
        text, _ = sermon_file_text(upload(b"First line  \r\nSecond\r\n\r\n\r\n\r\nThird\r\n"))
        self.assertEqual(text, "First line\nSecond\n\nThird")

    def test_word_files_keep_their_paragraphs(self):
        data = docx_bytes(["The Good Shepherd", ["The Lord ", "is my ", "shepherd."], "", "I shall not want."])
        text, kind = sermon_file_text(upload(data, "sermon.docx"))
        self.assertEqual(text, "The Good Shepherd\n\nThe Lord is my shepherd.\n\nI shall not want.")
        self.assertEqual(kind, "docx")

    def test_word_text_with_ampersands_and_quotes_is_read_correctly(self):
        data = docx_bytes(["Faith &amp; works &lt;together&gt;"])
        text, _ = sermon_file_text(upload(data))
        self.assertEqual(text, "Faith & works <together>")

    def test_pdfs_with_text(self):
        data = pdf_bytes(["Blessed are the meek,", "for they shall inherit the earth."])
        text, kind = sermon_file_text(upload(data, "sermon.pdf"))
        self.assertIn("Blessed are the meek,", text)
        self.assertIn("inherit the earth.", text)
        self.assertEqual(kind, "pdf")

    def test_a_pdf_of_scanned_pages_is_refused_with_a_reason(self):
        self.assertIn("scanned", self.refused(pdf_bytes([]), "scan.pdf"))

    def test_a_broken_pdf_is_refused(self):
        self.assertIn("couldn't be read", self.refused(b"%PDF-1.4\nthis is not really a pdf", "bad.pdf"))

    def test_old_word_files_are_refused_with_how_to_fix_it(self):
        old_word = bytes.fromhex("D0CF11E0A1B11AE1") + b"\0" * 100
        self.assertIn("Save it as a .docx", self.refused(old_word, "sermon.doc"))

    def test_other_files_are_refused_whatever_their_name(self):
        for data in (b"\x89PNG\r\n\x1a\n" + b"\0" * 50, b"\x00\x01\x02binary\x00stuff"):
            with self.subTest(data=data[:4]):
                self.assertIn("Word (.docx), PDF or plain text", self.refused(data, "sermon.txt"))

    def test_a_zip_that_isnt_a_word_file_is_refused(self):
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, "w") as archive:
            archive.writestr("[Content_Types].xml", "<Types/>")
            archive.writestr("xl/workbook.xml", "<workbook/>")
        self.assertIn("Word (.docx), PDF or plain text", self.refused(buffer.getvalue(), "sermon.docx"))

    def test_a_word_file_that_would_unpack_to_something_huge_is_refused(self):
        padding = "<w:p><w:r><w:t>" + "a" * (sermon_text.MAX_WORD_XML + 10) + "</w:t></w:r></w:p>"
        data = docx_bytes([], extra_files={})
        buffer = io.BytesIO()
        with zipfile.ZipFile(io.BytesIO(data)) as original, zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
            archive.writestr("[Content_Types].xml", original.read("[Content_Types].xml"))
            archive.writestr("word/document.xml", f'<w:document xmlns:w="{"http://schemas.openxmlformats.org/wordprocessingml/2006/main"}"><w:body>{padding}</w:body></w:document>')
        self.assertIn("too large", self.refused(buffer.getvalue(), "big.docx"))

    def test_empty_files_and_files_with_no_words(self):
        self.assertIn("empty", self.refused(b""))
        self.assertIn("no words", self.refused(b"   \n\n  "))
        self.assertIn("no words", self.refused(docx_bytes(["", "  "]), "blank.docx"))

    def test_files_over_the_size_limit(self):
        self.assertIn("4 MB", self.refused(b"a" * (sermon_text.MAX_BYTES + 1)))

    def test_text_longer_than_a_sermon_document_can_hold(self):
        self.assertIn("too long", self.refused(b"word " * (sermon_text.MAX_TEXT // 5 + 10)))


class TitleFromNameTests(SimpleTestCase):
    def test_titles_come_from_the_file_name(self):
        cases = {
            "The_Good-Shepherd.docx": "The Good Shepherd",
            "2026-03-01 Easter sermon.pdf": "2026-03-01 Easter sermon",
            "C:\\Users\\Pastor\\Grace.txt": "Grace",
            ".docx": "Sermon",
            "": "Sermon",
        }
        for name, title in cases.items():
            with self.subTest(name=name):
                self.assertEqual(sermon_text.title_from_name(name), title)

    def test_long_names_are_shortened(self):
        self.assertEqual(len(sermon_text.title_from_name("a" * 500 + ".txt")), 300)
