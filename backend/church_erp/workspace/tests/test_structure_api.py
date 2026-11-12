"""The church's structure through the API (AGENT_EXECUTION_PLAN.md, Task 8.1)."""
from django.core.cache import cache
from django.urls import reverse
from rest_framework.test import APITestCase

from church_erp.core.models import Branch, StaffChange
from church_erp.workspace.models import Appointment

from .helpers import appoint, build_synod


class StructureTestCase(APITestCase):
    def setUp(self):
        cache.clear()
        self.addCleanup(cache.clear)
        build_synod(self)

    def as_(self, user):
        self.client.force_authenticate(user)
        return self.client


class MeTests(StructureTestCase):
    def test_members_learn_where_they_belong_and_what_they_may_do(self):
        appoint(self.elder, self.session_clerk, branch=self.a1)
        data = self.as_(self.elder).get(reverse("workspace-me")).data
        self.assertTrue(data["member"])
        self.assertEqual(data["branch"]["slug"], "a1")
        self.assertEqual(data["presbytery"]["slug"], "north")
        self.assertEqual([a["title"] for a in data["appointments"]], ["Session Clerk, A1"])
        self.assertEqual(data["organise"], {"branches": [{"slug": "a1", "name": "A1"}], "presbyteries": [], "synod": False})

    def test_website_staff_are_told_they_are_not_members(self):
        data = self.as_(self.editor).get(reverse("workspace-me")).data
        self.assertFalse(data["member"])

    def test_signed_out_people_are_refused(self):
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(reverse("workspace-me")).status_code, 401)


class StructureViewTests(StructureTestCase):
    def test_members_see_presbyteries_branches_and_office_bearers(self):
        appoint(self.elder_a2, self.presbytery_clerk, presbytery=self.north)
        appoint(self.elder_b1, self.synod_clerk)
        data = self.as_(self.elder).get(reverse("workspace-structure")).data
        north = next(p for p in data["presbyteries"] if p["slug"] == "north")
        self.assertEqual([b["slug"] for b in north["branches"]], ["a1", "a2"])
        self.assertEqual(north["office_bearers"][0]["title"], "Clerk")
        self.assertEqual(north["office_bearers"][0]["person"]["name"], "Elder_A2")
        self.assertEqual(data["synod"]["office_bearers"][0]["person"]["name"], "Elder_B1")
        # Only names: no email, phone or username.
        self.assertEqual(set(north["office_bearers"][0]["person"]), {"id", "name", "branch"})

    def test_non_members_are_refused(self):
        self.assertEqual(self.as_(self.editor).get(reverse("workspace-structure")).status_code, 403)


class AppointmentTests(StructureTestCase):
    def appoint_via_api(self, user, **body):
        return self.as_(user).post(reverse("workspace-appointments-list"), body, format="json")

    def test_a_minister_appoints_their_session_clerk(self):
        response = self.appoint_via_api(self.minister, person=self.elder.pk, position=self.session_clerk.pk, branch="a1")
        self.assertEqual(response.status_code, 201, response.data)
        self.assertTrue(Appointment.objects.current().filter(person=self.elder, position=self.session_clerk).exists())
        self.assertTrue(StaffChange.objects.filter(section="appointments", action="added").exists())

    def test_a_new_holder_replaces_the_old_one(self):
        old = appoint(self.elder, self.session_clerk, branch=self.a1)
        response = self.appoint_via_api(self.minister, person=self.minister.pk, position=self.session_clerk.pk, branch="a1")
        self.assertEqual(response.status_code, 201, response.data)
        old.refresh_from_db()
        self.assertIsNotNone(old.ended_on)
        self.assertEqual(Appointment.objects.current().filter(position=self.session_clerk, branch=self.a1).count(), 1)

    def test_refusals(self):
        cases = [
            (self.minister, dict(person=self.elder_a2.pk, position=self.session_clerk.pk, branch="a2"), 403),
            (self.minister, dict(person=self.elder_a2.pk, position=self.session_clerk.pk, branch="a1"), 400),
            (self.minister, dict(person=self.elder.pk, position=self.presbytery_clerk.pk, presbytery="north"), 403),
            (self.elder, dict(person=self.elder.pk, position=self.session_clerk.pk, branch="a1"), 403),
            (self.editor, dict(person=self.elder.pk, position=self.session_clerk.pk, branch="a1"), 403),
        ]
        for user, body, expected in cases:
            with self.subTest(user=user.username, body=body):
                self.assertEqual(self.appoint_via_api(user, **body).status_code, expected)
        self.assertFalse(Appointment.objects.exists())

    def test_the_superuser_appoints_presbytery_and_synod_office_bearers(self):
        self.assertEqual(self.appoint_via_api(
            self.root, person=self.elder_a2.pk, position=self.presbytery_clerk.pk, presbytery="north").status_code, 201)
        self.assertEqual(self.appoint_via_api(self.root, person=self.elder_b1.pk, position=self.synod_clerk.pk).status_code, 201)

    def test_ending_an_appointment_keeps_it_on_record(self):
        held = appoint(self.elder, self.session_clerk, branch=self.a1)
        url = reverse("workspace-appointments-detail", args=[held.pk])
        self.assertEqual(self.as_(self.elder_a2).delete(url).status_code, 403)
        self.assertEqual(self.as_(self.minister).delete(url).status_code, 204)
        held.refresh_from_db()
        self.assertIsNotNone(held.ended_on)


class PeopleSearchTests(StructureTestCase):
    def test_members_find_other_members_by_name_with_their_branch_and_offices(self):
        appoint(self.elder_b1, self.synod_clerk)
        rows = self.as_(self.minister).get(reverse("workspace-people") + "?q=elder").data
        self.assertEqual({r["name"] for r in rows}, {"Elder", "Elder_A2", "Elder_B1"})
        b1 = next(r for r in rows if r["name"] == "Elder_B1")
        self.assertEqual(b1["branch"], {"slug": "b1", "name": "B1"})
        self.assertEqual(b1["offices"], ["Synod Clerk"])
        self.assertEqual(set(b1), {"id", "name", "branch", "presbytery", "offices"})

    def test_website_staff_and_suspended_people_are_not_listed(self):
        self.elder_a2.is_active = False
        self.elder_a2.save()
        names = {r["name"] for r in self.as_(self.minister).get(reverse("workspace-people")).data}
        self.assertNotIn("Editor", names)
        self.assertNotIn("Elder_A2", names)
        self.assertNotIn("Root", names)

    def test_people_can_be_narrowed_to_a_branch_or_presbytery(self):
        url = reverse("workspace-people")
        self.assertEqual({r["name"] for r in self.as_(self.minister).get(url + "?branch=a1").data}, {"Minister", "Elder"})
        self.assertEqual({r["name"] for r in self.as_(self.minister).get(url + "?presbytery=south").data}, {"Elder_B1"})


class PresbyteryAdminTests(StructureTestCase):
    def test_the_superuser_adds_presbyteries_and_places_branches_in_them(self):
        response = self.as_(self.root).post(reverse("staff-presbyteries-list"), {"name": "DR Congo"}, format="json")
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["slug"], "dr-congo")
        moved = self.as_(self.root).patch(reverse("staff-branches-detail", args=["a2"]), {"presbytery": "south"}, format="json")
        self.assertEqual(moved.status_code, 200, moved.data)
        self.assertEqual(Branch.objects.get(slug="a2").presbytery, self.south)

    def test_nobody_else_can(self):
        for user in (self.minister, self.elder):
            with self.subTest(user=user.username):
                self.assertEqual(self.as_(user).post(reverse("staff-presbyteries-list"), {"name": "X"}, format="json").status_code, 403)
