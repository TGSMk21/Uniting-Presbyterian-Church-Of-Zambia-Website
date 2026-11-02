"""Per-branch home page content (AGENT_EXECUTION_PLAN.md, Task 1.2b)."""
from datetime import time

from django.contrib.auth.models import Group
from django.core.management import call_command
from django.urls import reverse
from rest_framework.test import APITestCase

from church_erp.accounts.models import User
from church_erp.core.models import ServiceTime

from .helpers import make_branch


class BranchHomeContentApiTests(APITestCase):
    def setUp(self):
        self.branch = make_branch("alpha")
        self.branch.tagline = "A place of grace"
        self.branch.welcome_text = "Welcome to Alpha."
        self.branch.year_theme_title = "Rooted in Faith"
        self.branch.year_theme_text = "This year we pray."
        self.branch.save()
        ServiceTime.objects.create(
            branch=self.branch, day="Every Wednesday", title="Bible Study",
            start_time=time(16, 30), end_time=time(18, 30), location="Hall", order=2,
        )
        ServiceTime.objects.create(
            branch=self.branch, day="Every Sunday", title="Worship",
            start_time=time(9), end_time=time(11), location="Sanctuary",
            details="Worship · Word · Communion", order=1,
        )
        other = make_branch("beta")
        ServiceTime.objects.create(
            branch=other, day="Every Friday", title="Theirs",
            start_time=time(18), end_time=time(19), location="X",
        )

    def branch_data(self):
        return self.client.get(reverse("branch-detail", args=["alpha"])).data

    def test_branch_exposes_its_home_content(self):
        data = self.branch_data()
        self.assertEqual(data["tagline"], "A place of grace")
        self.assertEqual(data["welcome_text"], "Welcome to Alpha.")
        self.assertEqual(data["year_theme_title"], "Rooted in Faith")
        self.assertEqual(data["year_theme_text"], "This year we pray.")
        self.assertIsNone(data["hero_image"])
        self.assertIsNone(data["hero_image_secondary"])

    def test_branch_lists_only_its_own_service_times_in_order(self):
        services = self.branch_data()["service_times"]
        self.assertEqual([s["title"] for s in services], ["Worship", "Bible Study"])
        self.assertEqual(services[0]["day"], "Every Sunday")
        self.assertEqual(services[0]["start_time"], "09:00:00")
        self.assertEqual(services[0]["details"], "Worship · Word · Communion")


class ServiceTimeAdminTests(APITestCase):
    def test_branch_admin_group_can_manage_service_times(self):
        call_command("setup_roles", verbosity=0)
        codenames = set(
            Group.objects.get(name="Branch Admin").permissions.values_list("codename", flat=True)
        )
        self.assertTrue({"add_servicetime", "change_servicetime", "delete_servicetime"} <= codenames)

    def test_service_times_are_edited_inline_on_the_branch(self):
        call_command("setup_roles", verbosity=0)
        branch = make_branch("alpha")
        admin = User.objects.create_user("badmin", is_staff=True, branch=branch, role="branch_admin")
        self.client.force_login(admin)
        response = self.client.get(reverse("admin:core_branch_change", args=[branch.pk]))
        self.assertEqual(response.status_code, 200)
        inline_models = {f.formset.model for f in response.context["inline_admin_formsets"]}
        self.assertIn(ServiceTime, inline_models)
