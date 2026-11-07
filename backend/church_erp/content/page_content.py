"""Which wording on the website staff can edit.

page_schema.json lists every editable field with today's wording as its default.
The website keeps an identical copy (Utilities/pageSchema.json), because the two
deploy separately; a test fails if they differ. Only changes are stored, so a page
nobody has edited simply shows its defaults.
"""
import json
import re
from pathlib import Path

from django.core.exceptions import ValidationError
from django.core.validators import validate_email
from django.db import transaction

from .models import PageContent

SCHEMA = json.loads((Path(__file__).parent / "page_schema.json").read_text(encoding="utf-8"))
NATIONAL = "national"
EDITOR_ROLES = {"branch_admin", "content_editor"}
PHONE_RE = re.compile(r"^\+?[0-9][0-9 ()\-]{5,28}$")


def scope_kind(scope):
    return "national" if scope == NATIONAL else "branch"


def field_specs(kind, page):
    """{key: field} for a page, or {} if there's no such page."""
    sections = SCHEMA[kind].get(page, {}).get("sections", [])
    return {field["key"]: field for section in sections for field in section["fields"]}


def can_edit(user, branch):
    """`branch` is None for the national pages."""
    if user.is_superuser:
        return True
    if branch is None:
        return user.role == "super_admin"
    return user.branch_id == branch.pk and user.role in EDITOR_ROLES


def clean_value(spec, value):
    if not isinstance(value, str):
        raise ValidationError("Please enter text.")
    value = value.replace("\r\n", "\n").strip()
    if len(value) > spec["max"]:
        raise ValidationError(f"Please keep this to {spec['max']} characters.")
    if value and spec["type"] == "email":
        try:
            validate_email(value)
        except ValidationError:
            raise ValidationError("Please enter a valid email address.")
    if value and spec["type"] == "phone" and not PHONE_RE.match(value):
        raise ValidationError("Please enter a valid phone number.")
    return value


def clean_fields(kind, page, submitted):
    """Returns (cleaned values by key, errors by key)."""
    specs = field_specs(kind, page)
    cleaned, errors = {}, {}
    for key, value in submitted.items():
        if key not in specs:
            errors[key] = ["This can't be edited."]
            continue
        try:
            cleaned[key] = clean_value(specs[key], value)
        except ValidationError as exc:
            errors[key] = exc.messages
    return cleaned, errors


def current_fields(branch, page, kind):
    """What the edit form starts from: everything that differs from the defaults."""
    row = PageContent.objects.filter(branch=branch, page=page).first()
    fields = dict(row.fields) if row else {}
    for key, spec in field_specs(kind, page).items():
        if spec.get("store") == "branch" and getattr(branch, key):
            fields[key] = getattr(branch, key)
    return fields, row


def save_page(branch, page, kind, cleaned, user):
    """Replaces the page: fields left empty or equal to the original go back to it."""
    specs = field_specs(kind, page)
    overrides = {}
    branch_fields = []
    for key, spec in specs.items():
        value = cleaned.get(key, "")
        keep = value if value != spec["default"] else ""
        if spec.get("store") == "branch":
            setattr(branch, key, keep)
            branch_fields.append(key)
        elif keep:
            overrides[key] = keep
    with transaction.atomic():
        if branch_fields:
            branch.save(update_fields=branch_fields)
        if overrides:
            PageContent.objects.update_or_create(
                branch=branch, page=page, defaults={"fields": overrides, "updated_by": user},
            )
        else:
            PageContent.objects.filter(branch=branch, page=page).delete()
    return overrides
