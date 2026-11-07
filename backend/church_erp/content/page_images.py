"""Photos and logos uploaded from the dashboard.

Every upload is opened and saved again as a new WebP under a name we choose. That
refuses anything that isn't really a photo, and removes hidden data such as the
location where it was taken.
"""
import io
import logging
import uuid

from django.core.exceptions import ValidationError
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.db import transaction
from PIL import Image, ImageOps

from .models import PageContent

logger = logging.getLogger(__name__)

FORMATS = ("JPEG", "PNG", "WEBP")
# The website's host refuses requests over 4.5 MB, and the browser shrinks photos first.
MAX_BYTES = 4_000_000
# Opening an image takes about 4 bytes of memory per pixel, whatever its file size.
MAX_PIXELS = 25_000_000
WEBP_QUALITY = 82

TOO_LARGE = "This photo is too large. Please use a smaller one."
NOT_A_PHOTO = "This file can't be used. Please choose a JPG, PNG or WebP photo."


def prepared_image(uploaded, max_side):
    """The upload as a clean WebP file, or a ValidationError saying what's wrong with it."""
    if uploaded.size > MAX_BYTES:
        raise ValidationError(TOO_LARGE)
    try:
        with Image.open(uploaded, formats=FORMATS) as original:
            width, height = original.size
            if width * height > MAX_PIXELS:
                raise ValidationError(TOO_LARGE)
            original.load()
            image = ImageOps.exif_transpose(original)
    except Image.DecompressionBombError:
        raise ValidationError(TOO_LARGE)
    except (OSError, ValueError, SyntaxError, EOFError):
        raise ValidationError(NOT_A_PHOTO)

    transparent = image.mode in ("RGBA", "LA", "PA") or "transparency" in image.info
    image = image.convert("RGBA" if transparent else "RGB")
    image.thumbnail((max_side, max_side), Image.Resampling.LANCZOS)
    image.info.clear()

    data = io.BytesIO()
    image.save(data, "WEBP", quality=WEBP_QUALITY)
    content = ContentFile(data.getvalue())
    content.content_type = "image/webp"
    return content


def set_image(branch, page, spec, name, user):
    """Points the field at a stored file ("" to clear it). Returns the file it replaced."""
    key = spec["key"]
    if spec.get("store") == "branch":
        previous = getattr(branch, key).name
        setattr(branch, key, name)
        branch.save(update_fields=[key])
        return previous
    with transaction.atomic():
        row = PageContent.objects.select_for_update().filter(branch=branch, page=page).first()
        fields = dict(row.fields) if row else {}
        previous = fields.pop(key, "")
        if name:
            fields[key] = name
        if fields:
            PageContent.objects.update_or_create(
                branch=branch, page=page, defaults={"fields": fields, "updated_by": user},
            )
        elif row:
            row.delete()
    return previous


def delete_quietly(name):
    """A file left behind costs little, so a failure here shouldn't fail the request."""
    if not name:
        return
    try:
        default_storage.delete(name)
    except Exception:
        logger.exception("Couldn't delete the replaced image %s", name)


def replace_image(branch, page, spec, uploaded, user):
    """Returns the stored file's name."""
    content = prepared_image(uploaded, spec["max_side"])
    name = default_storage.save(f"page_images/{uuid.uuid4().hex}.webp", content)
    try:
        previous = set_image(branch, page, spec, name, user)
    except Exception:
        delete_quietly(name)
        raise
    delete_quietly(previous)
    return name


def remove_image(branch, page, spec, user):
    delete_quietly(set_image(branch, page, spec, "", user))
