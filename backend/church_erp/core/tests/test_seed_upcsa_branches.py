"""The main UPCZ branches (AGENT_EXECUTION_PLAN.md, Task 2.2)."""
from decimal import Decimal
from io import StringIO

from django.core.management import call_command
from django.test import TestCase
from django.urls import reverse

from church_erp.accounts.models import User
from church_erp.core.models import Branch

from .helpers import make_branch


def seed():
    out = StringIO()
    call_command("seed_upcsa_branches", stdout=out)
    return out.getvalue()


class SeedBranchesTests(TestCase):
    def test_creates_the_main_branches(self):
        seed()
        self.assertEqual(
            set(Branch.objects.values_list("slug", flat=True)),
            {
                "chilanga", "kanyama", "st-columbus-kabwe", "david-livingstone-memorial", "chawama",
                "matero", "kabwata", "kaunda-square", "kabanana", "misisi",
            },
        )
        memorial = Branch.objects.get(slug="david-livingstone-memorial")
        self.assertEqual(memorial.name, "David Livingstone Memorial Presbyterian Church")
        self.assertEqual(memorial.address, "Livingstone, Zambia")
        self.assertEqual(Branch.objects.get(slug="st-columbus-kabwe").address, "Kabwe, Zambia")
        self.assertTrue(memorial.is_active)

    def test_invents_no_contact_details_or_logins(self):
        seed()
        for branch in Branch.objects.all():
            with self.subTest(branch=branch.slug):
                self.assertEqual(branch.contact_email, "")
                self.assertEqual(branch.contact_phone, "")
                self.assertEqual(branch.youtube_channel_id, "")
        self.assertFalse(User.objects.exists())

    def test_every_branch_has_an_approximate_map_location(self):
        seed()
        for branch in Branch.objects.all():
            with self.subTest(branch=branch.slug):
                branch.full_clean()
                self.assertIsNotNone(branch.latitude)
                self.assertIsNotNone(branch.longitude)
                self.assertFalse(branch.location_confirmed)
                # Roughly within Zambia's bounds: catches swapped or mistyped values.
                self.assertTrue(-18.5 < branch.latitude < -8)
                self.assertTrue(21.5 < branch.longitude < 34)

    def test_rerun_adds_nothing_and_keeps_real_details_entered_later(self):
        seed()
        Branch.objects.filter(slug="kabwata").update(
            contact_email="office@kabwata.example.org", address="Plot 1, Kabwata",
            latitude=Decimal("-15.400000"), longitude=Decimal("28.300000"), location_confirmed=True,
        )
        output = seed()
        self.assertEqual(Branch.objects.count(), 10)
        kabwata = Branch.objects.get(slug="kabwata")
        self.assertEqual(kabwata.contact_email, "office@kabwata.example.org")
        self.assertEqual(kabwata.address, "Plot 1, Kabwata")
        self.assertEqual(kabwata.latitude, Decimal("-15.400000"))
        self.assertTrue(kabwata.location_confirmed)
        self.assertIn("0 created", output)

    def test_existing_branch_keeps_its_details_and_gains_a_map_location(self):
        chilanga = make_branch("chilanga")
        seed()
        chilanga.refresh_from_db()
        self.assertEqual(chilanga.name, "Chilanga")
        self.assertEqual(chilanga.address, "Chilanga Road")
        self.assertIsNotNone(chilanga.latitude)
        self.assertEqual(Branch.objects.count(), 10)


class BranchLocationApiTests(TestCase):
    def test_api_exposes_location_for_the_locator(self):
        seed()
        row = self.client.get(reverse("branch-detail", args=["misisi"])).json()
        self.assertEqual(float(row["latitude"]), -15.438)
        self.assertEqual(float(row["longitude"]), 28.2818)
        self.assertIs(row["location_confirmed"], False)
