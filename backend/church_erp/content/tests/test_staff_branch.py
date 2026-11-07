"""Branch details and map position from the dashboard (AGENT_EXECUTION_PLAN.md, Task 5.3)."""
from decimal import Decimal

from django.core.cache import cache
from django.urls import reverse
from rest_framework.test import APITestCase

from church_erp.accounts.models import User
from church_erp.core.models import Branch
from church_erp.core.tests.helpers import make_branch

LUSAKA = {"latitude": "-15.416700", "longitude": "28.283300"}


def staff(username, branch=None, role="content_editor"):
    return User.objects.create_user(username, password="pw", is_staff=True, branch=branch, role=role)


def url(scope):
    return reverse("staff-branch-details", args=[scope])


class BranchDetailsTestCase(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.alpha = make_branch("alpha")
        cls.beta = make_branch("beta")
        cls.editor = staff("editor", cls.alpha)

    def setUp(self):
        cache.clear()
        self.addCleanup(cache.clear)
        self.client.force_authenticate(self.editor)

    def save(self, scope="alpha", **fields):
        return self.client.patch(url(scope), fields, format="json")


class AccessTests(BranchDetailsTestCase):
    def test_signed_out_is_refused(self):
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(url("alpha")).status_code, 401)
        self.assertEqual(self.save(contact_phone="1").status_code, 401)

    def test_editor_reads_their_branch(self):
        response = self.client.get(url("alpha"))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["name"], "Alpha")
        self.assertEqual(response.data["contact_email"], "alpha@example.org")
        self.assertEqual(
            set(response.data),
            {"name", "slug", "contact_email", "contact_phone", "address", "latitude", "longitude", "location_confirmed"},
        )

    def test_other_branch_is_refused(self):
        self.assertEqual(self.client.get(url("beta")).status_code, 403)
        self.assertEqual(self.save("beta", contact_phone="999").status_code, 403)
        self.beta.refresh_from_db()
        self.assertEqual(self.beta.contact_phone, "0000")

    def test_roles_without_content_editing_are_refused(self):
        for role in ("finance_admin", "super_admin"):
            self.client.force_authenticate(staff(f"{role}_user", self.alpha, role=role))
            self.assertEqual(self.client.get(url("alpha")).status_code, 403, role)

    def test_superuser_can_edit_any_branch(self):
        self.client.force_authenticate(User.objects.create_superuser("root", password="pw"))
        self.assertEqual(self.save("beta", contact_phone="0977 000 000").status_code, 200)
        self.beta.refresh_from_db()
        self.assertEqual(self.beta.contact_phone, "0977 000 000")

    def test_unknown_and_inactive_branches_are_not_found(self):
        self.client.force_authenticate(User.objects.create_superuser("root", password="pw"))
        self.assertEqual(self.client.get(url("nowhere")).status_code, 404)
        self.beta.is_active = False
        self.beta.save()
        self.assertEqual(self.client.get(url("beta")).status_code, 404)

    def test_only_get_and_patch(self):
        self.assertEqual(self.client.post(url("alpha"), {}, format="json").status_code, 405)
        self.assertEqual(self.client.delete(url("alpha")).status_code, 405)
        self.assertTrue(Branch.objects.filter(pk=self.alpha.pk).exists())


class DetailsTests(BranchDetailsTestCase):
    def test_saves_contact_details(self):
        response = self.save(contact_email="office@alpha.org", contact_phone="+260 977 123 456",
                             address="Plot 1, Chilanga, Lusaka, Zambia")
        self.assertEqual(response.status_code, 200)
        self.alpha.refresh_from_db()
        self.assertEqual(
            (self.alpha.contact_email, self.alpha.contact_phone, self.alpha.address),
            ("office@alpha.org", "+260 977 123 456", "Plot 1, Chilanga, Lusaka, Zambia"),
        )

    def test_contact_details_may_be_cleared(self):
        self.assertEqual(self.save(contact_email="", contact_phone="", address="").status_code, 200)
        self.alpha.refresh_from_db()
        self.assertEqual((self.alpha.contact_email, self.alpha.contact_phone, self.alpha.address), ("", "", ""))

    def test_bad_email_and_phone_are_refused(self):
        response = self.save(contact_email="not an email", contact_phone="call me")
        self.assertEqual(response.status_code, 400)
        self.assertIn("contact_email", response.data)
        self.assertIn("contact_phone", response.data)

    def test_long_values_are_refused(self):
        response = self.save(contact_phone="1" * 21, address="x" * 501)
        self.assertEqual(response.status_code, 400)
        self.assertIn("contact_phone", response.data)
        self.assertIn("address", response.data)

    def test_name_slug_and_other_fields_cannot_be_changed(self):
        self.save(name="Renamed", slug="renamed", is_active=False, youtube_channel_id="UCxxxxxxxxxxxxxxxxxxxxxx",
                  tagline="Changed here")
        self.alpha.refresh_from_db()
        self.assertEqual(
            (self.alpha.name, self.alpha.slug, self.alpha.is_active, self.alpha.youtube_channel_id, self.alpha.tagline),
            ("Alpha", "alpha", True, "", ""),
        )

    def test_change_shows_in_the_public_branch(self):
        self.save(contact_phone="0211 000 111")
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(reverse("branch-detail", args=["alpha"])).data["contact_phone"], "0211 000 111")


class MapPositionTests(BranchDetailsTestCase):
    def test_saves_and_confirms_a_position(self):
        response = self.save(**LUSAKA, location_confirmed=True)
        self.assertEqual(response.status_code, 200)
        self.alpha.refresh_from_db()
        self.assertEqual((self.alpha.latitude, self.alpha.longitude), (Decimal("-15.416700"), Decimal("28.283300")))
        self.assertTrue(self.alpha.location_confirmed)

    def test_extra_decimals_are_rounded(self):
        response = self.save(latitude="-15.41670049", longitude="28.28330051")
        self.assertEqual(response.status_code, 200)
        self.alpha.refresh_from_db()
        self.assertEqual((self.alpha.latitude, self.alpha.longitude), (Decimal("-15.416700"), Decimal("28.283301")))

    def test_position_outside_zambia_is_refused(self):
        for lat, lng in (("51.5", "-0.12"), ("-15.4", "38.0"), ("-25.0", "28.0"), ("-15.4", "15.0")):
            response = self.save(latitude=lat, longitude=lng)
            self.assertEqual(response.status_code, 400, (lat, lng))
            self.assertIn("Zambia", " ".join(str(m) for m in response.data["latitude"]))
        self.alpha.refresh_from_db()
        self.assertIsNone(self.alpha.latitude)

    def test_edges_of_zambia_are_allowed(self):
        for lat, lng in (("-8.2", "31.0"), ("-18.1", "26.0"), ("-13.0", "21.9"), ("-11.0", "33.7")):
            self.assertEqual(self.save(latitude=lat, longitude=lng).status_code, 200, (lat, lng))

    def test_half_a_position_is_refused(self):
        response = self.save(latitude="-15.4")
        self.assertEqual(response.status_code, 400)
        self.assertIn("latitude", response.data)
        self.save(**LUSAKA)
        response = self.save(longitude=None)
        self.assertEqual(response.status_code, 400)
        self.alpha.refresh_from_db()
        self.assertIsNotNone(self.alpha.longitude)

    def test_position_can_be_cleared(self):
        self.save(**LUSAKA)
        response = self.save(latitude=None, longitude=None)
        self.assertEqual(response.status_code, 200)
        self.alpha.refresh_from_db()
        self.assertIsNone(self.alpha.latitude)

    def test_cannot_confirm_without_a_position(self):
        response = self.save(location_confirmed=True)
        self.assertEqual(response.status_code, 400)
        self.assertIn("location_confirmed", response.data)
        self.alpha.refresh_from_db()
        self.assertFalse(self.alpha.location_confirmed)

    def test_clearing_the_position_needs_confirmation_off(self):
        self.save(**LUSAKA, location_confirmed=True)
        response = self.save(latitude=None, longitude=None)
        self.assertEqual(response.status_code, 400)
        self.assertIn("location_confirmed", response.data)
        self.assertEqual(self.save(latitude=None, longitude=None, location_confirmed=False).status_code, 200)

    def test_confirmed_position_reaches_the_public_list(self):
        self.save(**LUSAKA, location_confirmed=True)
        self.client.force_authenticate(None)
        rows = self.client.get(reverse("branch-list")).data["results"]
        alpha = next(row for row in rows if row["slug"] == "alpha")
        self.assertEqual((alpha["latitude"], alpha["longitude"], alpha["location_confirmed"]),
                         ("-15.416700", "28.283300", True))
