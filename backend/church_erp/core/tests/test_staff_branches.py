"""Branches from the dashboard (AGENT_EXECUTION_PLAN.md, Task 5.4).

Superusers add branches, rename them, set their YouTube channel, and turn
them off and on. A branch's web address never changes once it's made."""
from django.core.cache import cache
from django.urls import reverse
from rest_framework.test import APITestCase

from church_erp.accounts.models import User
from church_erp.core.models import Branch
from church_erp.core.tests.helpers import make_branch

LIST = reverse("staff-branches-list")
CHANNEL = "UC" + "a" * 22


def detail(slug):
    return reverse("staff-branches-detail", args=[slug])


class BranchesTestCase(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.alpha = make_branch("alpha")
        cls.closed = make_branch("closed")
        cls.closed.is_active = False
        cls.closed.save()
        cls.boss = User.objects.create_superuser("boss", password="pw")
        cls.admin_a = User.objects.create_user("admin_a", password="pw", is_staff=True, branch=cls.alpha, role="branch_admin")

    def setUp(self):
        # Staff saves are rate limited per account; start each test afresh.
        cache.clear()
        self.addCleanup(cache.clear)
        self.client.force_authenticate(self.boss)

    def new(self, **extra):
        return {"name": "Kabwe Presbyterian Church", "slug": "kabwe", "contact_email": "kabwe@example.org", **extra}


class AccessTests(BranchesTestCase):
    def test_only_superusers(self):
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(LIST).status_code, 401)
        self.client.force_authenticate(self.admin_a)
        self.assertEqual(self.client.get(LIST).status_code, 403)
        self.assertEqual(self.client.post(LIST, self.new(), format="json").status_code, 403)
        self.assertEqual(self.client.patch(detail("alpha"), {"name": "Mine"}, format="json").status_code, 403)

    def test_lists_closed_branches_too(self):
        rows = self.client.get(LIST).data["results"]
        self.assertEqual([(r["slug"], r["is_active"]) for r in rows], [("alpha", True), ("closed", False)])
        self.assertIn("staff_count", rows[0])


class AddTests(BranchesTestCase):
    def test_add_a_branch(self):
        response = self.client.post(LIST, self.new(youtube_channel_id=CHANNEL), format="json")
        self.assertEqual(response.status_code, 201, response.data)
        branch = Branch.objects.get(slug="kabwe")
        self.assertEqual((branch.name, branch.contact_email, branch.youtube_channel_id), (
            "Kabwe Presbyterian Church", "kabwe@example.org", CHANNEL,
        ))
        self.assertTrue(branch.is_active)

    def test_web_address_rules(self):
        for slug in ("Kabwe Town", "kabwe/x", "", "admin", "dashboard", "find-a-branch", "alpha", "ALPHA"):
            response = self.client.post(LIST, self.new(slug=slug), format="json")
            self.assertEqual(response.status_code, 400, slug)
            self.assertIn("slug", response.data, slug)
        self.assertEqual(self.client.post(LIST, self.new(slug="st-pauls-kabwe"), format="json").status_code, 201)

    def test_capitals_in_the_address_are_made_small(self):
        response = self.client.post(LIST, self.new(slug="Kabwe"), format="json")
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["slug"], "kabwe")

    def test_youtube_channel_must_look_like_one(self):
        for bad in ("@kabwechurch", "https://youtube.com/@kabwe", "UCshort", "UC" + "a" * 21 + "!"):
            response = self.client.post(LIST, self.new(youtube_channel_id=bad), format="json")
            self.assertEqual(response.status_code, 400, bad)
            self.assertIn("youtube_channel_id", response.data)

    def test_name_is_required_and_email_checked(self):
        self.assertEqual(self.client.post(LIST, self.new(name=" "), format="json").status_code, 400)
        response = self.client.post(LIST, self.new(contact_email="nope"), format="json")
        self.assertEqual(response.status_code, 400)
        self.assertIn("contact_email", response.data)

    def test_only_these_details_can_be_set(self):
        response = self.client.post(LIST, self.new(latitude="-15.0", is_active=False, tagline="x"), format="json")
        self.assertEqual(response.status_code, 201)
        branch = Branch.objects.get(slug="kabwe")
        self.assertIsNone(branch.latitude)
        self.assertEqual(branch.tagline, "")
        # A new branch starts switched on; it can be switched off after.
        self.assertTrue(branch.is_active)


class ChangeTests(BranchesTestCase):
    def test_rename_and_channel(self):
        response = self.client.patch(detail("alpha"), {"name": "Alpha Church", "youtube_channel_id": CHANNEL}, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        self.alpha.refresh_from_db()
        self.assertEqual((self.alpha.name, self.alpha.youtube_channel_id), ("Alpha Church", CHANNEL))
        response = self.client.patch(detail("alpha"), {"youtube_channel_id": ""}, format="json")
        self.assertEqual(response.status_code, 200)

    def test_address_never_changes(self):
        response = self.client.patch(detail("alpha"), {"slug": "beta"}, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertTrue(Branch.objects.filter(slug="alpha").exists())

    def test_switch_off_and_on(self):
        self.client.patch(detail("alpha"), {"is_active": False}, format="json")
        self.alpha.refresh_from_db()
        self.assertFalse(self.alpha.is_active)
        # The public site no longer lists it.
        self.client.force_authenticate(None)
        public = self.client.get(reverse("branch-list")).data["results"]
        self.assertNotIn("alpha", [b["slug"] for b in public])
        self.client.force_authenticate(self.boss)
        self.client.patch(detail("alpha"), {"is_active": True}, format="json")
        self.alpha.refresh_from_db()
        self.assertTrue(self.alpha.is_active)

    def test_nothing_is_deleted(self):
        self.assertEqual(self.client.delete(detail("alpha")).status_code, 405)
