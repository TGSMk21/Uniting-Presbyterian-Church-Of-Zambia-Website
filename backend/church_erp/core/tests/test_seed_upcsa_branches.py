"""Placeholder UPCSA Zambia branches (AGENT_EXECUTION_PLAN.md, Task 2.2)."""
from io import StringIO

from django.core.management import call_command
from django.test import TestCase

from church_erp.accounts.models import User
from church_erp.core.models import Branch

from .helpers import make_branch


def seed():
    out = StringIO()
    call_command("seed_upcsa_branches", stdout=out)
    return out.getvalue()


class SeedUpcsaBranchesTests(TestCase):
    def test_creates_the_known_congregations(self):
        seed()
        self.assertEqual(Branch.objects.count(), 14)
        kabushi = Branch.objects.get(slug="kabushi")
        self.assertEqual(kabushi.name, "Kabushi Presbyterian Church")
        self.assertEqual(kabushi.address, "Ndola, Zambia")
        self.assertTrue(kabushi.is_active)

    def test_invents_no_contact_details_or_logins(self):
        seed()
        for branch in Branch.objects.all():
            with self.subTest(branch=branch.slug):
                self.assertEqual(branch.contact_email, "")
                self.assertEqual(branch.contact_phone, "")
                self.assertEqual(branch.youtube_channel_id, "")
        self.assertFalse(User.objects.exists())

    def test_every_placeholder_passes_validation(self):
        seed()
        for branch in Branch.objects.all():
            with self.subTest(branch=branch.slug):
                branch.full_clean()

    def test_rerun_adds_nothing_and_keeps_real_details_entered_later(self):
        seed()
        Branch.objects.filter(slug="kabushi").update(
            contact_email="office@kabushi.example.org", address="Plot 1, Ndola"
        )
        output = seed()
        self.assertEqual(Branch.objects.count(), 14)
        kabushi = Branch.objects.get(slug="kabushi")
        self.assertEqual(kabushi.contact_email, "office@kabushi.example.org")
        self.assertEqual(kabushi.address, "Plot 1, Ndola")
        self.assertIn("0 created", output)

    def test_leaves_existing_branches_alone(self):
        chilanga = make_branch("chilanga")
        seed()
        chilanga.refresh_from_db()
        self.assertEqual(chilanga.name, "Chilanga")
        self.assertEqual(Branch.objects.count(), 15)
