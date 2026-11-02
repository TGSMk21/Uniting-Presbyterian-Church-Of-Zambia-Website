"""Backend dev-setup fixes (AGENT_EXECUTION_PLAN.md, Task 0.7)."""
from django.apps import apps
from django.core.management import CommandError, call_command
from django.test import TestCase, override_settings

from church_erp.accounts.models import User
from church_erp.content.models import Sermon
from church_erp.core.models import Branch

from .helpers import make_branch


class CeleryLoadingTests(TestCase):
    def test_celery_app_loads_with_django_settings(self):
        from church_erp import celery_app

        # CELERY_TIMEZONE in settings/base.py reaches the app only if it read Django settings.
        self.assertEqual(celery_app.conf.timezone, "Africa/Lusaka")


class CkeditorRemovalTests(TestCase):
    def test_unmaintained_ckeditor_is_not_installed(self):
        self.assertFalse(apps.is_installed("ckeditor"))


class BranchLogoTests(TestCase):
    def test_branch_validates_without_a_logo(self):
        branch = make_branch("alpha")
        branch.full_clean()  # raises ValidationError if logo is required


class SeedDemoTests(TestCase):
    def test_refuses_to_run_when_debug_is_off(self):
        with self.assertRaisesMessage(CommandError, "DEBUG"):
            call_command("seed_demo", verbosity=0)
        self.assertFalse(Branch.objects.exists())

    @override_settings(DEBUG=True)
    def test_seeds_a_demo_branch_with_content(self):
        call_command("seed_demo", verbosity=0)
        branch = Branch.objects.get(slug="chilanga")
        self.assertTrue(Sermon.objects.filter(branch=branch).exists())

    @override_settings(DEBUG=True)
    def test_creates_no_users(self):
        call_command("seed_demo", verbosity=0)
        self.assertFalse(User.objects.exists())

    @override_settings(DEBUG=True)
    def test_is_safe_to_rerun(self):
        call_command("seed_demo", verbosity=0)
        sermons = Sermon.objects.count()
        call_command("seed_demo", verbosity=0)
        self.assertEqual(Sermon.objects.count(), sermons)
        self.assertEqual(Branch.objects.filter(slug="chilanga").count(), 1)
