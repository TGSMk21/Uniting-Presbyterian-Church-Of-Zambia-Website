"""Nightly database backups to the private bucket (AGENT_EXECUTION_PLAN.md, Phase 6).

Supabase's free plan keeps no backups we can restore, so the site copies its
own data: Django's `dumpdata`, gzipped, as backups/upcz-YYYY-MM-DD.json.gz in
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

from django.core.files import File
from django.core.files.storage import storages
from django.core.management import call_command
from django.utils import timezone

FOLDER = "backups"
KEEP = 30
NAME = re.compile(r"upcz-\d{4}-\d{2}-\d{2}\.json\.gz")
LEFT_OUT = [
    "contenttypes",
    "auth.permission",
    "sessions",
    "token_blacklist",
    "ai_messages.sermonembedding",
]


def make_backup(now=None):
    """Save today's backup, replacing any made earlier today, and delete the oldest
    beyond KEEP. Returns what was done. Safe to run again (Rule 5)."""
    day = timezone.localdate(now or timezone.now())
    name = f"{FOLDER}/upcz-{day.isoformat()}.json.gz"
    storage = storages["private"]

    with tempfile.TemporaryDirectory() as folder:
        plain = os.path.join(folder, "upcz.json")
        call_command(
            "dumpdata", natural_foreign=True, natural_primary=True,
            exclude=LEFT_OUT, output=plain, verbosity=0,
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
