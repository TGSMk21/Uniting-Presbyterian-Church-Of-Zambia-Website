"""The old free-form Page model is gone (AGENT_EXECUTION_PLAN.md, Task 5.2).

Page wording lives in PageContent; nothing read Page, so its table, admin
section and /api/pages/ address were removed."""
from django.apps import apps
from django.contrib.auth.models import Permission
from django.core.management import call_command
from django.test import TestCase

from church_erp.core.management.commands.setup_roles import ROLE_GROUPS


class NoPageModelTests(TestCase):
    def test_the_model_and_its_address_are_gone(self):
        with self.assertRaises(LookupError):
            apps.get_model("content", "Page")
        self.assertEqual(self.client.get("/api/pages/").status_code, 404)

    def test_roles_no_longer_grant_page_permissions_and_still_set_up(self):
        for spec in ROLE_GROUPS.values():
            self.assertNotIn("page", spec.get("content", {}))
        # Render runs this on every start; a missing permission would stop the server.
        call_command("setup_roles", stdout=open("/dev/null", "w"))
        self.assertFalse(Permission.objects.filter(content_type__app_label="content", codename__endswith="_page").exists())
