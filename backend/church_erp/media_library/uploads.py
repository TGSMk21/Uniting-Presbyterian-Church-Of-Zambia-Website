"""Files added to the media library from the dashboard.

A file's kind is decided by what's inside it, never by its name. Photos are
saved again as WebP, which removes hidden data such as where they were taken;
other files are kept as they are, under a name we choose.
"""
import zipfile

from django.core.exceptions import ValidationError
from django.core.files.base import File

from church_erp.content.page_images import prepared_image

# The website's host refuses requests over 4.5 MB.
MAX_BYTES = 4_000_000
LIBRARY_PHOTO_SIDE = 2560

TOO_LARGE = "This file is too large. Files can be up to 4 MB."
EMPTY = "This file is empty."
VIDEO = "Videos can't be added here. Please put them on your YouTube channel."
NOT_ALLOWED = (
    "This kind of file can't be added. Please choose a photo (JPG, PNG or WebP), a PDF, "
    "a Word, Excel or PowerPoint file, or an MP3 or M4A recording."
)

OFFICE = (("word/", "docx"), ("xl/", "xlsx"), ("ppt/", "pptx"))
AUDIO_BRANDS = (b"M4A ", b"M4B ")
WEBM = bytes([0x1A, 0x45, 0xDF, 0xA3])  # also MKV


def _office_kind(uploaded):
    try:
        with zipfile.ZipFile(uploaded) as archive:
            names = archive.namelist()
    except (zipfile.BadZipFile, OSError, ValueError):
        return None
    if "[Content_Types].xml" not in names:
        return None
    for folder, extension in OFFICE:
        if any(name.startswith(folder) for name in names):
            return extension
    return None


def checked_upload(uploaded):
    """(content, file_type, extension) for a file that may be kept, or a ValidationError."""
    if uploaded.size == 0:
        raise ValidationError(EMPTY)
    if uploaded.size > MAX_BYTES:
        raise ValidationError(TOO_LARGE)
    uploaded.seek(0)
    head = uploaded.read(16)
    uploaded.seek(0)

    if head.startswith((b"\xff\xd8\xff", b"\x89PNG\r\n\x1a\n")) or (head[:4] == b"RIFF" and head[8:12] == b"WEBP"):
        return prepared_image(uploaded, LIBRARY_PHOTO_SIDE), "image", "webp"
    if head.startswith(b"%PDF-"):
        return File(uploaded), "document", "pdf"
    if head.startswith(b"PK\x03\x04"):
        extension = _office_kind(uploaded)
        uploaded.seek(0)
        if extension:
            return File(uploaded), "document", extension
        raise ValidationError(NOT_ALLOWED)
    if head.startswith(b"ID3") or (len(head) > 1 and head[0] == 0xFF and head[1] & 0xE0 == 0xE0):
        return File(uploaded), "audio", "mp3"
    if head.startswith(WEBM) or (head[:4] == b"RIFF" and head[8:12] == b"AVI "):
        raise ValidationError(VIDEO)  # WebM, MKV, AVI
    if head[4:8] == b"ftyp":
        if head[8:12] in AUDIO_BRANDS:
            return File(uploaded), "audio", "m4a"
        raise ValidationError(VIDEO)
    raise ValidationError(NOT_ALLOWED)
