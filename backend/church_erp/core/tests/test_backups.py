"""Nightly database backups to the private bucket (AGENT_EXECUTION_PLAN.md, Phase 6).

Supabase's free plan keeps no backups we can restore, so the site copies its
own data each night: Django's dumpdata, gzipped, in the private bucket, one
file a day, the newest 30 kept. Restoring is `migrate` then `loaddata`."""
import gzip
import json
import os
import tempfile
from datetime import date, datetime
from unittest import mock
from zoneinfo import ZoneInfo

from django.conf import settings
from django.core.files.base import ContentFile
from django.core.files.storage import storages
from django.core.management import call_command
from django.test import TestCase, TransactionTestCase, override_settings
from django.urls import reverse

from church_erp.accounts.models import User
from church_erp.ai_messages.models import DailyMessage, SermonDocument, SermonEmbedding
from church_erp.content.models import Sermon
from church_erp.core import backups
from church_erp.core.models import Branch, Minister
from church_erp.core.tests.helpers import make_branch

IN_MEMORY = {
    **settings.STORAGES,
    "private": {"BACKEND": "django.core.files.storage.InMemoryStorage"},
}
LUSAKA = ZoneInfo("Africa/Lusaka")


def at(year, month, day, hour=2):
    return datetime(year, month, day, hour, tzinfo=LUSAKA)


def read_backup(name):
    with storages["private"].open(name) as handle:
        return json.loads(gzip.decompress(handle.read()))


def models_in(rows):
    return {row["model"] for row in rows}


@override_settings(STORAGES=IN_MEMORY)
class MakeBackupTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        branch = make_branch("alpha")
        minister = Minister.objects.create(branch=branch, name="Banda")
        User.objects.create_user("editor", password="pw", is_staff=True, branch=branch, role="content_editor")
        document = SermonDocument.objects.create(minister=minister, title="Grace", text="Words")
        SermonEmbedding.objects.create(document=document, chunk_index=0, chunk_text="Words", embedding=[0.1] * 1536, model="m")
        DailyMessage.objects.create(minister=minister, title="Light", message="m", date=date(2026, 11, 8))
        from django.contrib.sessions.backends.db import SessionStore
        SessionStore().create()
        call_command("setup_roles", stdout=open(os.devnull, "w"))

    def setUp(self):
        # The in-memory bucket lasts for the whole class; start each test empty.
        storage = storages["private"]
        if storage.exists("backups"):
            for name in storage.listdir("backups")[1]:
                storage.delete(f"backups/{name}")

    def test_the_whole_database_is_saved_privately_under_the_day_in_zambia(self):
        # 23:30 UTC on the 7th is already the 8th in Zambia.
        report = backups.make_backup(now=datetime(2026, 11, 7, 23, 30, tzinfo=ZoneInfo("UTC")))
        self.assertEqual(report["file"], "backups/upcz-2026-11-08.json.gz")
        self.assertTrue(storages["private"].exists(report["file"]))
        rows = read_backup(report["file"])
        self.assertTrue({
            "core.branch", "core.minister", "accounts.user", "ai_messages.sermondocument", "ai_messages.dailymessage",
        } <= models_in(rows))
        self.assertGreater(report["bytes"], 0)

    def test_what_django_or_the_daily_job_rebuild_is_left_out(self):
        rows = read_backup(backups.make_backup(now=at(2026, 11, 8))["file"])
        for left_out in ("contenttypes.contenttype", "auth.permission", "sessions.session", "ai_messages.sermonembedding"):
            self.assertNotIn(left_out, models_in(rows))

    def test_links_are_saved_by_name_so_they_fit_a_freshly_set_up_database(self):
        # A new database numbers its permissions and content types its own way.
        rows = read_backup(backups.make_backup(now=at(2026, 11, 8))["file"])
        group = next(row for row in rows if row["model"] == "auth.group")
        self.assertNotIn("pk", group)
        self.assertTrue(all(isinstance(p, list) and len(p) == 3 for p in group["fields"]["permissions"]))
        user = next(row for row in rows if row["model"] == "accounts.user")
        self.assertTrue(all(isinstance(g, list) for g in user["fields"]["groups"]))

    def test_running_it_again_the_same_day_replaces_that_days_file(self):
        backups.make_backup(now=at(2026, 11, 8, 2))
        Branch.objects.create(name="Later", slug="later", contact_email="l@example.org", contact_phone="1", address="r")
        backups.make_backup(now=at(2026, 11, 8, 3))
        _, files = storages["private"].listdir("backups")
        self.assertEqual(files, ["upcz-2026-11-08.json.gz"])
        slugs = {row["fields"]["slug"] for row in read_backup("backups/upcz-2026-11-08.json.gz") if row["model"] == "core.branch"}
        self.assertIn("later", slugs)

    def test_only_the_newest_30_days_are_kept_and_other_files_are_left_alone(self):
        storage = storages["private"]
        for day in range(1, 36):
            storage.save(f"backups/upcz-2026-10-{day:02d}.json.gz" if day <= 31 else f"backups/upcz-2026-11-{day - 31:02d}.json.gz", ContentFile(b"x"))
        storage.save("backups/notes.txt", ContentFile(b"keep me"))
        report = backups.make_backup(now=at(2026, 11, 8))
        _, files = storage.listdir("backups")
        kept = sorted(f for f in files if f.startswith("upcz-"))
        self.assertEqual(len(kept), 30)
        self.assertEqual(kept[-1], "upcz-2026-11-08.json.gz")
        self.assertEqual(kept[0], "upcz-2026-10-07.json.gz")
        self.assertIn("notes.txt", files)
        self.assertEqual(report["deleted"], 6)


@override_settings(STORAGES=IN_MEMORY)
class RestoreTests(TransactionTestCase):
    """A backup put back into an empty, migrated database gives the same rows."""

    def test_flush_then_loaddata_brings_everything_back(self):
        branch = make_branch("alpha")
        minister = Minister.objects.create(branch=branch, name="Banda")
        User.objects.create_user("editor", password="pw", is_staff=True, branch=branch, role="content_editor")
        Sermon.objects.create(branch=branch, title="S", video_id="abc", preached_at=at(2026, 11, 1))
        message = DailyMessage.objects.create(minister=minister, title="Light", message="m", date=date(2026, 11, 8))
        message.source_documents.set([SermonDocument.objects.create(minister=minister, title="Grace", text="Words")])
        before = {
            "branches": list(Branch.objects.values_list("slug", flat=True)),
            "users": list(User.objects.values_list("username", "password")),
            "sources": list(message.source_documents.values_list("title", flat=True)),
        }
        name = backups.make_backup(now=at(2026, 11, 8))["file"]

        call_command("flush", interactive=False, verbosity=0)
        self.assertFalse(Branch.objects.exists())
        with tempfile.TemporaryDirectory() as folder:
            path = os.path.join(folder, "upcz.json.gz")
            with storages["private"].open(name) as handle, open(path, "wb") as out:
                out.write(handle.read())
            call_command("loaddata", path, verbosity=0)

        self.assertEqual(list(Branch.objects.values_list("slug", flat=True)), before["branches"])
        self.assertEqual(list(User.objects.values_list("username", "password")), before["users"])
        restored = DailyMessage.objects.get(title="Light")
        self.assertEqual(list(restored.source_documents.values_list("title", flat=True)), before["sources"])


URL = reverse("backup-database")


@override_settings(SYNC_TOKEN="s3cret-token")
class BackupEndpointTests(TestCase):
    def test_correct_token_makes_a_backup_and_reports_it(self):
        report = {"file": "backups/upcz-2026-11-08.json.gz", "bytes": 10, "kept": 1, "deleted": 0}
        with mock.patch("church_erp.api.views.make_backup", return_value=report) as make:
            response = self.client.post(URL, HTTP_X_SYNC_TOKEN="s3cret-token")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), report)
        make.assert_called_once_with()

    def test_a_failure_is_reported_as_a_failure_so_the_scheduler_can_say_so(self):
        with mock.patch("church_erp.api.views.make_backup", side_effect=OSError("bucket unreachable")), \
                self.assertLogs("church_erp.api.views", level="ERROR"):
            response = self.client.post(URL, HTTP_X_SYNC_TOKEN="s3cret-token")
        self.assertEqual(response.status_code, 500)
        self.assertEqual(response.json(), {"error": "The backup failed; see the server's logs."})

    def test_wrong_or_missing_token_and_other_methods_are_refused(self):
        with mock.patch("church_erp.api.views.make_backup") as make:
            self.assertEqual(self.client.post(URL, HTTP_X_SYNC_TOKEN="guess").status_code, 403)
            self.assertEqual(self.client.post(URL).status_code, 403)
            self.assertEqual(self.client.get(URL, HTTP_X_SYNC_TOKEN="s3cret-token").status_code, 405)
            make.assert_not_called()

    @override_settings(SYNC_TOKEN="")
    def test_disabled_without_a_configured_token(self):
        with mock.patch("church_erp.api.views.make_backup") as make:
            self.assertEqual(self.client.post(URL, HTTP_X_SYNC_TOKEN="").status_code, 404)
            make.assert_not_called()


@override_settings(STORAGES=IN_MEMORY)
class BackupCommandTests(TestCase):
    def test_the_command_makes_one_too(self):
        make_branch("alpha")
        with mock.patch.object(backups.timezone, "now", return_value=at(2026, 11, 8)):
            call_command("backup_database", stdout=open(os.devnull, "w"))
        self.assertTrue(storages["private"].exists("backups/upcz-2026-11-08.json.gz"))
