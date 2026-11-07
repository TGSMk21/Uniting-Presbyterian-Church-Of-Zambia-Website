"""Nightly database backups to the private bucket (AGENT_EXECUTION_PLAN.md, Phase 6).

Supabase's free plan keeps no backups we can restore, so the site copies its
own data in Django's `dumpdata` format (natural keys), gzipped, as backups/upcz-YYYY-MM-DD.json.gz in
the private bucket (the day in Zambia), the newest 30 kept. It needs no extra
programs on the host. To restore into an empty database: `migrate`, then
`loaddata upcz-YYYY-MM-DD.json.gz` (backend/README.md, "Backups").

Left out: what Django rebuilds itself (content types, permissions, sessions,
expired-token lists) and sermon passages' embeddings, which are large and which
the hourly daily-messages job makes again for every sermon that has none.

The file holds everything else, password hashes and two-step login secrets
included, so it only ever goes to the private bucket.
"""
import gzip
import os
import re
import shutil
import tempfile

from django.apps import apps
from django.core import serializers
from django.core.files import File
from django.core.files.storage import storages
from django.db.models import ForeignKey, OneToOneField, Prefetch
from django.utils import timezone

FOLDER = "backups"
KEEP = 30
NAME = re.compile(r"upcz-\d{4}-\d{2}-\d{2}\.json\.gz")
LEFT_OUT_APPS = {"contenttypes", "sessions", "token_blacklist"}
LEFT_OUT_MODELS = {"auth.permission", "ai_messages.sermonembedding"}


def _natural_links(model):
    """Names of `model`'s foreign keys to models saved by name (natural keys)."""
    return [
        field.name for field in model._meta.concrete_fields
        if isinstance(field, (ForeignKey, OneToOneField)) and hasattr(field.related_model, "natural_key")
    ]


def _rows(model):
    """Every row, with linked rows fetched in bulk rather than one query per row.
    Each query is a round trip from Render to Supabase; per-row lookups made the
    first live backup take 35 seconds."""
    rows = model._base_manager.select_related(*_natural_links(model))
    prefetches = [
        # A permission is saved by name together with its content type's name.
        Prefetch(field.name, queryset=field.related_model._base_manager.select_related(*_natural_links(field.related_model)))
        for field in model._meta.many_to_many
        if field.remote_field.through._meta.auto_created
    ]
    return rows.prefetch_related(*prefetches).order_by(model._meta.pk.name)


def _models():
    """The same models, in the same order, as `dumpdata --natural-foreign` would save."""
    configs = [
        (config, None) for config in apps.get_app_configs()
        if config.label not in LEFT_OUT_APPS and config.models_module is not None
    ]
    return [
        model for model in serializers.sort_dependencies(configs, allow_cycles=True)
        if not model._meta.proxy and model._meta.label_lower not in LEFT_OUT_MODELS
    ]


def _objects():
    for model in _models():
        # In chunks, so memory stays small; links are still fetched in bulk for each chunk.
        yield from _rows(model).iterator(chunk_size=500)


def make_backup(now=None):
    """Save today's backup, replacing any made earlier today, and delete the oldest
    beyond KEEP. Returns what was done. Safe to run again (Rule 5)."""
    day = timezone.localdate(now or timezone.now())
    name = f"{FOLDER}/upcz-{day.isoformat()}.json.gz"
    storage = storages["private"]

    with tempfile.TemporaryDirectory() as folder:
        plain = os.path.join(folder, "upcz.json")
        with open(plain, "w", encoding="utf-8") as out:
            # Django's own format, so `loaddata` restores it.
            serializers.serialize(
                "json", _objects(), stream=out, use_natural_foreign_keys=True, use_natural_primary_keys=True,
            )
        packed = plain + ".gz"
        with open(plain, "rb") as source, gzip.open(packed, "wb") as target:
            shutil.copyfileobj(source, target)
        size = os.path.getsize(packed)
        if storage.exists(name):
            storage.delete(name)
        with open(packed, "rb") as handle:
            saved = storage.save(name, File(handle))

    _, files = storage.listdir(FOLDER)
    dated = sorted(f for f in files if NAME.fullmatch(f))
    old = dated[:-KEEP] if len(dated) > KEEP else []
    for file in old:
        storage.delete(f"{FOLDER}/{file}")
    return {"file": saved, "bytes": size, "kept": len(dated) - len(old), "deleted": len(old)}
