"""Who belongs where, and who may organise and appoint (AGENT_EXECUTION_PLAN.md, Task 8.1)."""
from django.core.exceptions import ValidationError
from django.test import TestCase

from church_erp.core.models import Presbytery
from church_erp.workspace import scopes
from church_erp.workspace.models import Appointment, Position

from .helpers import appoint, build_synod


class SeedTests(TestCase):
    def test_the_four_presbyteries_and_the_starting_positions_exist(self):
        names = set(Presbytery.objects.values_list("name", flat=True))
        self.assertTrue({"Copperbelt", "Eastern Zambia", "M'chinga", "Munali"} <= names)
        positions = set(Position.objects.values_list("level", "name"))
        self.assertTrue({
            ("branch", "Session Clerk"), ("branch", "Treasurer"),
            ("presbytery", "Moderator"), ("presbytery", "Clerk"), ("presbytery", "Treasurer"),
            ("synod", "Moderator"), ("synod", "Clerk"), ("synod", "Treasurer"),
        } <= positions)
        # Session Clerks, Moderators and Clerks plan meetings; Treasurers don't.
        self.assertTrue(Position.objects.get(level="branch", name="Session Clerk").can_organise)
        self.assertFalse(Position.objects.get(level="branch", name="Treasurer").can_organise)


class MembershipTests(TestCase):
    def setUp(self):
        build_synod(self)

    def test_ministers_elders_and_office_bearers_are_in_the_workspace(self):
        self.assertTrue(scopes.is_member(self.minister))
        self.assertTrue(scopes.is_member(self.elder))
        self.assertTrue(scopes.is_member(self.root))
        # Website staff aren't, unless they hold a position.
        self.assertFalse(scopes.is_member(self.editor))
        appoint(self.editor, self.treasurer, branch=self.a1)
        self.assertTrue(scopes.is_member(self.editor))

    def test_suspended_and_signed_out_people_are_not(self):
        self.elder.is_active = False
        self.assertFalse(scopes.is_member(self.elder))
        from django.contrib.auth.models import AnonymousUser
        self.assertFalse(scopes.is_member(AnonymousUser()))

    def test_where_a_person_belongs(self):
        self.assertEqual(scopes.presbytery_of(self.elder), self.north)
        self.assertEqual(scopes.presbytery_of(self.elder_b1), self.south)
        self.a2.presbytery = None
        self.a2.save()
        self.elder_a2.refresh_from_db()
        self.assertIsNone(scopes.presbytery_of(self.elder_a2))


class OrganiseTests(TestCase):
    def setUp(self):
        build_synod(self)

    def test_a_minister_organises_at_their_own_branch_only(self):
        self.assertTrue(scopes.can_organise(self.minister, "branch", branch=self.a1))
        self.assertFalse(scopes.can_organise(self.minister, "branch", branch=self.a2))
        self.assertFalse(scopes.can_organise(self.minister, "presbytery", presbytery=self.north))
        self.assertFalse(scopes.can_organise(self.minister, "synod"))

    def test_office_bearers_who_organise_do_so_where_they_hold_office(self):
        self.assertFalse(scopes.can_organise(self.elder, "branch", branch=self.a1))
        appoint(self.elder, self.session_clerk, branch=self.a1)
        self.assertTrue(scopes.can_organise(self.elder, "branch", branch=self.a1))
        self.assertFalse(scopes.can_organise(self.elder, "branch", branch=self.a2))
        appoint(self.elder_a2, self.presbytery_clerk, presbytery=self.north)
        self.assertTrue(scopes.can_organise(self.elder_a2, "presbytery", presbytery=self.north))
        self.assertFalse(scopes.can_organise(self.elder_a2, "presbytery", presbytery=self.south))
        appoint(self.elder_b1, self.synod_clerk)
        self.assertTrue(scopes.can_organise(self.elder_b1, "synod"))

    def test_treasurers_and_ended_appointments_dont_organise(self):
        appoint(self.elder, self.treasurer, branch=self.a1)
        self.assertFalse(scopes.can_organise(self.elder, "branch", branch=self.a1))
        clerk = appoint(self.elder, self.session_clerk, branch=self.a1)
        clerk.ended_on = clerk.started_on
        clerk.save()
        self.assertFalse(scopes.can_organise(self.elder, "branch", branch=self.a1))

    def test_superusers_organise_anywhere_and_others_nowhere(self):
        self.assertTrue(scopes.can_organise(self.root, "synod"))
        self.assertTrue(scopes.can_organise(self.root, "presbytery", presbytery=self.south))
        self.assertFalse(scopes.can_organise(self.editor, "branch", branch=self.a1))

    def test_places_a_person_may_organise_at(self):
        appoint(self.elder_a2, self.presbytery_clerk, presbytery=self.north)
        places = scopes.organising_places(self.elder_a2)
        self.assertEqual(places, {"branches": [], "presbyteries": [self.north], "synod": False})
        self.assertEqual(scopes.organising_places(self.minister)["branches"], [self.a1])


class AppointTests(TestCase):
    def setUp(self):
        build_synod(self)

    def test_a_minister_appoints_their_branch_office_bearers_only(self):
        self.assertTrue(scopes.can_appoint(self.minister, self.session_clerk, branch=self.a1))
        self.assertFalse(scopes.can_appoint(self.minister, self.session_clerk, branch=self.a2))
        self.assertFalse(scopes.can_appoint(self.minister, self.presbytery_clerk, presbytery=self.north))
        self.assertFalse(scopes.can_appoint(self.elder, self.session_clerk, branch=self.a1))
        self.assertTrue(scopes.can_appoint(self.root, self.synod_clerk))

    def test_appointments_must_fit_the_position_and_the_person(self):
        problems = [
            (self.elder, self.session_clerk, self.a2, None),        # someone from another branch
            (self.elder, self.session_clerk, None, self.north),     # wrong kind of place
            (self.elder_b1, self.presbytery_clerk, None, self.north),  # from another presbytery
            (self.elder, self.synod_clerk, self.a1, None),          # synod positions have no place
            (self.root, self.synod_clerk, None, None),              # superusers hold no office
        ]
        for person, position, branch, presbytery in problems:
            with self.subTest(person=person.username, position=str(position)):
                with self.assertRaises(ValidationError):
                    Appointment(person=person, position=position, branch=branch, presbytery=presbytery).full_clean()
        Appointment(person=self.elder, position=self.session_clerk, branch=self.a1).full_clean()
