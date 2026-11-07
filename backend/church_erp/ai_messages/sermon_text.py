"""The words of a pastor's sermon file (AGENT_EXECUTION_PLAN.md, Task 4.1).

Word (.docx), PDF and plain text are read here. The kind of file is decided
by what's inside it, never by its name. Scanned pages have no text to read and
would need OCR, so they're refused with a reason.
"""
import io
import logging
import re
import zipfile
from xml.etree import ElementTree

from django.core.exceptions import ValidationError

logger = logging.getLogger(__name__)

# The website's host refuses requests over 4.5 MB.
MAX_BYTES = 4_000_000
# About 30,000 words: far more than any sermon.
MAX_TEXT = 200_000
# A Word file's text, unpacked. Guards against files that unpack to something huge.
MAX_WORD_XML = 20_000_000
MAX_PDF_PAGES = 200
TITLE_LENGTH = 300

EMPTY = "This file is empty."
TOO_LARGE = "This file is too large. Files can be up to 4 MB."
NO_WORDS = "This file has no words in it."
TOO_LONG = "This sermon is too long to keep here. Please split it into parts."
NOT_ALLOWED = "This kind of file can't be read. Please choose a Word (.docx), PDF or plain text (.txt) file."
OLD_WORD = "This is an older Word file. Save it as a .docx in Word (File, Save As), then add that one."
SCANNED = (
    "This PDF has no text to read: it looks like scanned pictures of the pages. "
    "Please add the typed file instead, or paste the words in."
)
UNREADABLE = "This file couldn't be read. It may be damaged. Please save it again and try once more."

OLE = bytes.fromhex("D0CF11E0A1B11AE1")  # older Word, Excel and PowerPoint files
W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"


def tidy(text):
    """Unix line endings, no spaces at line ends, at most one empty line in a row."""
    text = text.replace("\r\n", "\n").replace("\r", "\n").replace(" ", " ")
    lines = [line.rstrip() for line in text.split("\n")]
    text = "\n".join(lines)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def _docx_text(data):
    try:
        with zipfile.ZipFile(io.BytesIO(data)) as archive:
            names = archive.namelist()
            if "[Content_Types].xml" not in names or "word/document.xml" not in names:
                raise ValidationError(NOT_ALLOWED)
            if archive.getinfo("word/document.xml").file_size > MAX_WORD_XML:
                raise ValidationError(TOO_LARGE)
            xml = archive.read("word/document.xml")
    except (zipfile.BadZipFile, OSError, ValueError, KeyError):
        raise ValidationError(UNREADABLE)
    try:
        # ElementTree never fetches outside files, and Python's expat refuses entity bombs.
        root = ElementTree.fromstring(xml)
    except ElementTree.ParseError:
        raise ValidationError(UNREADABLE)

    paragraphs = []
    for paragraph in root.iter(f"{W}p"):
        parts = []
        for node in paragraph.iter():
            if node.tag == f"{W}t":
                parts.append(node.text or "")
            elif node.tag == f"{W}tab":
                parts.append("\t")
            elif node.tag in (f"{W}br", f"{W}cr"):
                parts.append("\n")
        text = "".join(parts).strip()
        if text:
            paragraphs.append(text)
    return "\n\n".join(paragraphs)


def _pdf_text(data):
    from pypdf import PdfReader
    from pypdf.errors import PyPdfError

    try:
        reader = PdfReader(io.BytesIO(data))
        if reader.is_encrypted:
            raise ValidationError("This PDF is locked with a password. Please add an unlocked copy.")
        pages = reader.pages[:MAX_PDF_PAGES]
        text = "\n\n".join((page.extract_text() or "").strip() for page in pages)
    except ValidationError:
        raise
    except (PyPdfError, ValueError, KeyError, TypeError, AttributeError, OSError) as exc:
        logger.info("Couldn't read a PDF: %s", exc)
        raise ValidationError(UNREADABLE)
    if not text.strip():
        raise ValidationError(SCANNED)
    return text


def _plain_text(data):
    if b"\x00" in data:
        raise ValidationError(NOT_ALLOWED)
    for encoding in ("utf-8-sig", "cp1252"):
        try:
            text = data.decode(encoding)
        except UnicodeDecodeError:
            continue
        # Control characters other than tabs and line breaks mean it isn't text.
        if re.search(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", text):
            raise ValidationError(NOT_ALLOWED)
        return text
    raise ValidationError(NOT_ALLOWED)


def sermon_file_text(uploaded):
    """(text, kind) for a file that can be read, where kind is docx, pdf or txt;
    otherwise a ValidationError that says why, in plain words."""
    if uploaded.size == 0:
        raise ValidationError(EMPTY)
    if uploaded.size > MAX_BYTES:
        raise ValidationError(TOO_LARGE)
    uploaded.seek(0)
    data = uploaded.read(MAX_BYTES + 1)
    uploaded.seek(0)

    if data.startswith(b"%PDF-"):
        text, kind = _pdf_text(data), "pdf"
    elif data.startswith(b"PK\x03\x04"):
        text, kind = _docx_text(data), "docx"
    elif data.startswith(OLE):
        raise ValidationError(OLD_WORD)
    else:
        text, kind = _plain_text(data), "txt"

    text = tidy(text)
    if not text:
        raise ValidationError(NO_WORDS)
    if len(text) > MAX_TEXT:
        raise ValidationError(TOO_LONG)
    return text, kind


def title_from_name(name):
    """A title from a file's name: "The_Good-Shepherd.docx" becomes "The Good Shepherd"."""
    base = re.split(r"[\\/]", name or "")[-1]
    if "." in base:
        base = base.rsplit(".", 1)[0]
    # Dashes and underscores between words become spaces; dates such as 2026-03-01 stay.
    base = re.sub(r"(?<!\d)[-_]+|[-_]+(?!\d)", " ", base)
    base = re.sub(r"[_\s]+", " ", base).strip()
    return (base or "Sermon")[:TITLE_LENGTH]
