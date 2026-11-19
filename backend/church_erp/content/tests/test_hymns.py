"""Hymns (MOBILE_APP_PLAN.md, Phase 6): the model, the public app addresses, and the
superuser-only staff API with bulk import and change history."""
from django.db import IntegrityError, transaction
from django.urls import reverse
from rest_framework.test import APITestCase

from church_erp.accounts.models import User
from church_erp.content.models import Hymn
from church_erp.core.models import StaffChange

COLLECTIONS_URL = reverse("app-hymn-collections")
HYMNS_URL = reverse("app-hymns")
STAFF_URL = reverse("staff-hymns-list")
STAFF_IMPORT_URL = reverse("staff-hymns-import")


def hymn(collection="english", number=1, title="Amazing Grace", verses=None, chorus="", notes=""):
    return Hymn.objects.create(
        collection=collection, number=number, title=title,
        verses=verses if verses is not None else ["Verse one", "Verse two"], chorus=chorus, notes=notes,
    )


def superuser(username="root"):
    return User.objects.create_user(username, password="pw", is_staff=True, is_superuser=True)


def editor(username="ed"):
    return User.objects.create_user(username, password="pw", is_staff=True)


class HymnModelTests(APITestCase):
    def test_unique_collection_and_number_and_ordering(self):
        hymn("english", 2, "Second")
        hymn("english", 1, "First")
        hymn("tumbuka", 1, "Choyamba")
        self.assertEqual(
            [h.title for h in Hymn.objects.all()],
            ["First", "Second", "Choyamba"],  # collections sort alphabetically; the app orders by number
        )
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                hymn("english", 1, "Duplicate")
        self.assertEqual(str(Hymn.objects.get(number=1, collection="english")), "English Hymns 1: First")


class PublicAppHymnsTests(APITestCase):
    def setUp(self):
        hymn("english", 1, "Amazing Grace", chorus="How sweet", notes="1779")
        hymn("english", 2, "Second")
        hymn("tumbuka", 1, "Choyamba")
        hymn("chewa", 5, "Chikondi")

    def test_collections_summary_with_counts_and_labels(self):
        data = self.client.get(COLLECTIONS_URL).data
        self.assertEqual(data["collections"], [
            {"collection": "tumbuka", "label": "Tumbuka Hymns", "count": 1},
            {"collection": "chewa", "label": "Chewa Hymns", "count": 1},
            {"collection": "english", "label": "English Hymns", "count": 2},
        ])

    def test_collection_rows_ordered_by_number_with_full_text(self):
        data = self.client.get(HYMNS_URL, {"collection": "english"}).data
        self.assertEqual(data["collection"], "english")
        self.assertEqual([r["number"] for r in data["hymns"]], [1, 2])
        row = data["hymns"][0]
        self.assertEqual(set(row), {"id", "collection", "number", "title", "verses", "chorus", "notes"})
        self.assertEqual(row["verses"], ["Verse one", "Verse two"])
        self.assertEqual(row["chorus"], "How sweet")

    def test_unknown_or_missing_collection_is_a_400_and_the_address_is_read_only(self):
        self.assertEqual(self.client.get(HYMNS_URL).status_code, 400)
        self.assertEqual(self.client.get(HYMNS_URL, {"collection": "latin"}).status_code, 400)
        self.assertEqual(self.client.post(HYMNS_URL, {"collection": "english"}, format="json").status_code, 405)
        self.assertEqual(self.client.get(COLLECTIONS_URL).status_code, 200)


class StaffHymnTests(APITestCase):
    def setUp(self):
        self.root = superuser()
        self.ed = editor()

    def test_staff_only_and_superuser_only(self):
        self.assertEqual(self.client.get(STAFF_URL).status_code, 401)
        self.client.force_authenticate(self.ed)
        self.assertEqual(self.client.get(STAFF_URL).status_code, 403)
        self.client.force_authenticate(self.root)
        self.assertEqual(self.client.get(STAFF_URL).status_code, 200)

    def test_create_validates_and_records_history(self):
        self.client.force_authenticate(self.root)
        bad = self.client.post(STAFF_URL, {
            "collection": "latin", "number": 1, "title": "X", "verses": ["v"],
        }, format="json")
        self.assertEqual(bad.status_code, 400)
        bad = self.client.post(STAFF_URL, {
            "collection": "english", "number": 0, "title": "X", "verses": ["v"],
        }, format="json")
        self.assertEqual(bad.status_code, 400)
        bad = self.client.post(STAFF_URL, {
            "collection": "english", "number": 1, "title": "X", "verses": "not-a-list",
        }, format="json")
        self.assertEqual(bad.status_code, 400)
        ok = self.client.post(STAFF_URL, {
            "collection": "english", "number": 1, "title": "Amazing Grace",
            "verses": ["v1"], "chorus": "c", "notes": "n",
        }, format="json")
        self.assertEqual(ok.status_code, 201, ok.data)
        self.assertEqual(Hymn.objects.count(), 1)
        entry = StaffChange.objects.get(section="hymns")
        self.assertEqual(entry.action, "create")
        self.assertEqual(entry.username, "root")
        self.assertIn("Amazing Grace", entry.target)

    def test_update_and_delete_record_history(self):
        self.client.force_authenticate(self.root)
        created = self.client.post(STAFF_URL, {
            "collection": "english", "number": 1, "title": "Old", "verses": ["v"],
        }, format="json")
        pk = created.data["id"]
        detail = reverse("staff-hymns-detail", args=[pk])
        patched = self.client.patch(detail, {"title": "New"}, format="json")
        self.assertEqual(patched.status_code, 200)
        self.assertEqual(Hymn.objects.get(pk=pk).title, "New")
        entry = StaffChange.objects.filter(section="hymns", action="update").get()
        self.assertEqual(entry.changes, ["title"])
        self.assertEqual(self.client.delete(detail).status_code, 204)
        self.assertEqual(Hymn.objects.count(), 0)
        self.assertTrue(StaffChange.objects.filter(section="hymns", action="delete").exists())

    def test_bulk_import_upserts_by_collection_and_number(self):
        hymn("english", 1, "Old title")
        self.client.force_authenticate(self.root)
        payload = {
            "hymns": [
                {"collection": "english", "number": 1, "title": "New title", "verses": ["a", "b"], "chorus": "c"},
                {"collection": "tumbuka", "number": 3, "title": "Mpya", "verses": ["z"]},
                {"collection": "bogus", "number": 1, "title": "Bad", "verses": ["x"]},
            ]
        }
        response = self.client.post(STAFF_IMPORT_URL, payload, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertIn("errors", response.data)
        self.assertEqual(Hymn.objects.count(), 1)  # nothing applied

        payload["hymns"] = payload["hymns"][:2]
        response = self.client.post(STAFF_IMPORT_URL, payload, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data, {"created": 1, "updated": 1, "total": 2})
        self.assertEqual(Hymn.objects.get(collection="english", number=1).title, "New title")
        self.assertTrue(Hymn.objects.filter(collection="tumbuka", number=3).exists())
        entry = StaffChange.objects.filter(section="hymns", action="bulk_import").get()
        self.assertIn("2", entry.target)
