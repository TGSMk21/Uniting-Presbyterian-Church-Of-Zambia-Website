"""Meetings and the calendar (AGENT_EXECUTION_PLAN.md, Task 8.3)."""
from datetime import timedelta

from django.core.cache import cache
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase

from church_erp.workspace.models import Meeting, MeetingAttendee, Notification

from .helpers import appoint, build_synod

LIST = reverse("workspace-meetings-list")


def detail(meeting, name="detail"):
    return reverse(f"workspace-meetings-{name}", args=[meeting.pk])


class MeetingTestCase(APITestCase):
    def setUp(self):
        cache.clear()
        self.addCleanup(cache.clear)
        build_synod(self)
        self.soon = timezone.now() + timedelta(days=3)

    def as_(self, user):
        self.client.force_authenticate(user)
        return self.client

    def make(self, organiser=None, attendees=(), level="branch", branch=None, presbytery=None, **extra):
        organiser = organiser or self.minister
        meeting = Meeting.objects.create(
            title=extra.pop("title", "Session meeting"), level=level,
            branch=branch if branch is not None or level != "branch" else self.a1, presbytery=presbytery,
            starts_at=extra.pop("starts_at", self.soon), organiser=organiser, **extra)
        for person in (organiser, *attendees):
            MeetingAttendee.objects.get_or_create(meeting=meeting, person=person)
        return meeting

    def create(self, user, **body):
        values = {"title": "Session meeting", "level": "branch", "branch": "a1",
                  "starts_at": self.soon.isoformat(), "attendees": [], **body}
        return self.as_(user).post(LIST, values, format="json")


class CreateTests(MeetingTestCase):
    def test_a_minister_plans_a_meeting_and_the_attendees_are_told(self):
        response = self.create(self.minister, attendees=[self.elder.pk], venue="Vestry",
                               agenda="1. Prayer\n2. Finance")
        self.assertEqual(response.status_code, 201, response.data)
        meeting = Meeting.objects.get()
        self.assertEqual((meeting.organiser, meeting.branch, meeting.venue), (self.minister, self.a1, "Vestry"))
        # The organiser is on the list too, already attending.
        self.assertEqual(meeting.attendees.get(person=self.minister).response, "attending")
        note = Notification.objects.get(person=self.elder)
        self.assertEqual(note.kind, "meeting_invited")
        self.assertIn("Session meeting", note.text)
        self.assertEqual(note.link, f"/dashboard/meetings/{meeting.pk}")
        self.assertFalse(Notification.objects.filter(person=self.minister).exists())

    def test_only_organisers_at_that_place_plan_meetings_there(self):
        cases = [
            (self.elder, dict()),                                             # an elder who holds no office
            (self.minister, dict(branch="a2")),                               # another branch
            (self.minister, dict(level="presbytery", branch=None, presbytery="north")),
            (self.minister, dict(level="synod", branch=None)),
            (self.editor, dict()),                                            # website staff
        ]
        for user, body in cases:
            with self.subTest(user=user.username, body=body):
                self.assertIn(self.create(user, **body).status_code, (403,))
        self.assertFalse(Meeting.objects.exists())

    def test_office_bearers_who_organise_plan_meetings_at_their_level(self):
        appoint(self.elder, self.session_clerk, branch=self.a1)
        self.assertEqual(self.create(self.elder).status_code, 201)
        appoint(self.elder_a2, self.presbytery_clerk, presbytery=self.north)
        self.assertEqual(self.create(self.elder_a2, level="presbytery", branch=None, presbytery="north").status_code, 201)

    def test_the_place_must_match_the_level_and_the_details_must_make_sense(self):
        bad = [
            dict(level="presbytery", branch="a1"),
            dict(level="synod", branch="a1"),
            dict(title=""),
            dict(ends_at=(self.soon - timedelta(hours=1)).isoformat()),
            dict(online_link="http://insecure.example/call"),
            dict(online_link="javascript:alert(1)"),
            dict(attendees=[self.editor.pk]),     # not a workspace member
            dict(attendees=[999999]),
        ]
        for body in bad:
            with self.subTest(body=body):
                self.assertEqual(self.create(self.root, **body).status_code, 400)
        self.assertFalse(Meeting.objects.exists())


class SeeingTests(MeetingTestCase):
    def test_attendees_and_organisers_see_a_meeting_and_nobody_else(self):
        meeting = self.make(attendees=[self.elder])
        for user in (self.minister, self.elder, self.root):
            with self.subTest(user=user.username):
                self.assertEqual(self.as_(user).get(detail(meeting)).status_code, 200)
                self.assertIn(meeting.pk, [m["id"] for m in self.as_(user).get(LIST).data["results"]])
        for user in (self.elder_a2, self.elder_b1):
            with self.subTest(user=user.username):
                self.assertEqual(self.as_(user).get(detail(meeting)).status_code, 404)
                self.assertNotIn(meeting.pk, [m["id"] for m in self.as_(user).get(LIST).data["results"]])

    def test_fellow_organisers_at_the_place_see_and_manage_it(self):
        meeting = self.make()
        appoint(self.elder, self.session_clerk, branch=self.a1)
        data = self.as_(self.elder).get(detail(meeting)).data
        self.assertTrue(data["can_manage"])
        self.assertFalse(data["is_organiser"])
        self.assertTrue(self.as_(self.minister).get(detail(meeting)).data["is_organiser"])

    def test_the_list_shows_upcoming_or_past_and_the_detail_shows_who_is_coming(self):
        past = self.make(starts_at=timezone.now() - timedelta(days=2), title="Last month")
        upcoming = self.make(attendees=[self.elder], title="Next month")
        client = self.as_(self.minister)
        self.assertEqual([m["id"] for m in client.get(LIST + "?when=upcoming").data["results"]], [upcoming.pk])
        self.assertEqual([m["id"] for m in client.get(LIST + "?when=past").data["results"]], [past.pk])
        data = client.get(detail(upcoming)).data
        self.assertEqual({a["name"] for a in data["attendees"]}, {"Minister", "Elder"})
        self.assertEqual(data["place_title"], "A1")
        self.assertEqual(set(data["attendees"][0]), {"id", "name", "branch", "response", "present"})

    def test_a_date_range_for_the_month_view(self):
        inside = self.make(starts_at=timezone.now() + timedelta(days=40))
        self.make(starts_at=timezone.now() + timedelta(days=90))
        start = (timezone.now() + timedelta(days=35)).date().isoformat()
        end = (timezone.now() + timedelta(days=45)).date().isoformat()
        rows = self.as_(self.minister).get(f"{LIST}?from={start}&to={end}").data["results"]
        self.assertEqual([m["id"] for m in rows], [inside.pk])


class ChangeTests(MeetingTestCase):
    def test_changing_the_time_or_place_tells_everyone(self):
        meeting = self.make(attendees=[self.elder])
        response = self.as_(self.minister).patch(detail(meeting), {"venue": "Church hall"}, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(Notification.objects.get(person=self.elder).kind, "meeting_changed")

    def test_only_those_who_manage_it_change_it(self):
        meeting = self.make(attendees=[self.elder])
        self.assertEqual(self.as_(self.elder).patch(detail(meeting), {"title": "Mine now"}, format="json").status_code, 403)
        self.assertEqual(self.as_(self.elder_a2).patch(detail(meeting), {"title": "Mine now"}, format="json").status_code, 404)
        self.assertEqual(Meeting.objects.get().title, "Session meeting")

    def test_its_place_and_level_never_change(self):
        meeting = self.make()
        self.as_(self.root).patch(detail(meeting), {"level": "synod", "branch": "b1"}, format="json")
        meeting.refresh_from_db()
        self.assertEqual((meeting.level, meeting.branch), ("branch", self.a1))

    def test_cancelling_tells_everyone_and_keeps_it_on_the_calendar(self):
        meeting = self.make(attendees=[self.elder])
        self.assertEqual(self.as_(self.elder).post(detail(meeting, "cancel")).status_code, 403)
        self.assertEqual(self.as_(self.minister).post(detail(meeting, "cancel")).status_code, 200)
        meeting.refresh_from_db()
        self.assertEqual(meeting.status, "cancelled")
        self.assertEqual(Notification.objects.get(person=self.elder).kind, "meeting_cancelled")


class AttendeeTests(MeetingTestCase):
    def test_adding_and_removing_people(self):
        meeting = self.make()
        client = self.as_(self.minister)
        response = client.post(detail(meeting, "attendees"), {"add": [self.elder.pk, self.elder_a2.pk]}, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(Notification.objects.filter(kind="meeting_invited").count(), 2)
        client.post(detail(meeting, "attendees"), {"remove": [self.elder_a2.pk]}, format="json")
        self.assertEqual(set(meeting.attendees.values_list("person__username", flat=True)), {"minister", "elder"})
        # The organiser stays on.
        client.post(detail(meeting, "attendees"), {"remove": [self.minister.pk]}, format="json")
        self.assertTrue(meeting.attendees.filter(person=self.minister).exists())

    def test_attendees_answer_for_themselves_only(self):
        meeting = self.make(attendees=[self.elder])
        response = self.as_(self.elder).post(detail(meeting, "respond"), {"response": "apologies"}, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(meeting.attendees.get(person=self.elder).response, "apologies")
        self.assertEqual(self.as_(self.elder).post(detail(meeting, "respond"), {"response": "maybe"}, format="json").status_code, 400)
        self.assertEqual(self.as_(self.elder_a2).post(detail(meeting, "respond"), {"response": "attending"}, format="json").status_code, 404)

    def test_the_organiser_records_who_was_present(self):
        meeting = self.make(attendees=[self.elder, self.elder_a2], starts_at=timezone.now() - timedelta(hours=2))
        response = self.as_(self.minister).post(detail(meeting, "attendance"), {"present": [self.minister.pk, self.elder.pk]},
                                                 format="json")
        self.assertEqual(response.status_code, 200, response.data)
        rows = dict(meeting.attendees.values_list("person__username", "present"))
        self.assertEqual(rows, {"minister": True, "elder": True, "elder_a2": False})
        meeting.refresh_from_db()
        self.assertEqual(meeting.status, "held")
        self.assertEqual(self.as_(self.elder).post(detail(meeting, "attendance"), {"present": []}, format="json").status_code, 403)

    def test_attendance_waits_until_the_meeting_has_started(self):
        meeting = self.make(attendees=[self.elder])
        self.assertEqual(self.as_(self.minister).post(detail(meeting, "attendance"), {"present": []}, format="json").status_code, 400)


class CopyTests(MeetingTestCase):
    def test_copying_schedules_the_next_one_with_the_same_people(self):
        meeting = self.make(attendees=[self.elder], venue="Vestry", agenda="Prayer")
        next_month = self.soon + timedelta(days=28)
        response = self.as_(self.minister).post(detail(meeting, "copy"), {"starts_at": next_month.isoformat()}, format="json")
        self.assertEqual(response.status_code, 201, response.data)
        copy = Meeting.objects.exclude(pk=meeting.pk).get()
        self.assertEqual((copy.title, copy.venue, copy.agenda, copy.branch), ("Session meeting", "Vestry", "Prayer", self.a1))
        self.assertEqual(set(copy.attendees.values_list("person__username", flat=True)), {"minister", "elder"})
        self.assertEqual(self.as_(self.elder).post(detail(meeting, "copy"), {"starts_at": next_month.isoformat()},
                                                   format="json").status_code, 403)


class SuggestTests(MeetingTestCase):
    def test_groups_to_invite_in_a_tap(self):
        appoint(self.elder, self.session_clerk, branch=self.a1)
        appoint(self.elder_a2, self.session_clerk, branch=self.a2)
        appoint(self.elder_b1, self.synod_clerk)
        client = self.as_(self.root)
        groups = client.get(reverse("workspace-meetings-groups") + "?level=branch&branch=a1").data
        everyone = next(g for g in groups if g["key"] == "everyone")
        self.assertEqual({p["name"] for p in everyone["people"]}, {"Minister", "Elder"})
        groups = client.get(reverse("workspace-meetings-groups") + "?level=presbytery&presbytery=north").data
        clerks = next(g for g in groups if g["key"] == "position-Session Clerk")
        self.assertEqual({p["name"] for p in clerks["people"]}, {"Elder", "Elder_A2"})
        ministers = next(g for g in groups if g["key"] == "ministers")
        self.assertEqual({p["name"] for p in ministers["people"]}, {"Minister"})
        groups = client.get(reverse("workspace-meetings-groups") + "?level=synod").data
        officers = next(g for g in groups if g["key"] == "office-bearers")
        self.assertEqual({p["name"] for p in officers["people"]}, {"Elder_B1"})
        # The person planning is added anyway, so they're left out of the groups.
        groups = self.as_(self.minister).get(reverse("workspace-meetings-groups") + "?level=branch&branch=a1").data
        everyone = next(g for g in groups if g["key"] == "everyone")
        self.assertEqual({p["name"] for p in everyone["people"]}, {"Elder"})

    def test_the_list_comes_in_date_order(self):
        later = self.make(starts_at=self.soon + timedelta(days=2), attendees=[self.elder])
        sooner = self.make(attendees=[self.elder])
        ids = [m["id"] for m in self.as_(self.elder).get(LIST).data["results"]]
        self.assertEqual(ids, [sooner.pk, later.pk])


class CalendarFeedTests(MeetingTestCase):
    def test_a_private_link_gives_a_phone_calendar_my_meetings_only(self):
        mine = self.make(attendees=[self.elder], title="Session meeting", venue="Vestry")
        self.make(organiser=self.root, level="synod", branch=None, title="Not mine")
        response = self.as_(self.elder).post(reverse("workspace-calendar-feed"))
        self.assertEqual(response.status_code, 201)
        token = response.data["token"]
        self.client.force_authenticate(None)
        feed = self.client.get(reverse("workspace-calendar", args=[token]))
        self.assertEqual(feed.status_code, 200)
        self.assertEqual(feed["Content-Type"], "text/calendar; charset=utf-8")
        body = feed.content.decode()
        self.assertIn("BEGIN:VCALENDAR", body)
        self.assertIn("SUMMARY:Session meeting", body)
        self.assertIn(f"UID:upcz-meeting-{mine.pk}@", body)
        self.assertNotIn("Not mine", body)

    def test_a_new_link_replaces_the_old_and_wrong_links_find_nothing(self):
        first = self.as_(self.elder).post(reverse("workspace-calendar-feed")).data["token"]
        second = self.as_(self.elder).post(reverse("workspace-calendar-feed")).data["token"]
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(reverse("workspace-calendar", args=[first])).status_code, 404)
        self.assertEqual(self.client.get(reverse("workspace-calendar", args=[second])).status_code, 200)
        self.assertEqual(self.client.get(reverse("workspace-calendar", args=["x" * 43])).status_code, 404)

    def test_a_suspended_persons_link_stops_working(self):
        token = self.as_(self.elder).post(reverse("workspace-calendar-feed")).data["token"]
        self.elder.is_active = False
        self.elder.save()
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(reverse("workspace-calendar", args=[token])).status_code, 404)


class GapTests(MeetingTestCase):
    """Cases found by mutation checks."""

    def test_the_superuser_sees_meetings_even_at_a_closed_branch(self):
        meeting = self.make(branch=self.a2)
        self.a2.is_active = False
        self.a2.save()
        self.assertEqual(self.as_(self.root).get(detail(meeting)).status_code, 200)

    def test_a_synod_meeting_is_hidden_from_those_not_invited_or_organising_there(self):
        appoint(self.elder, self.synod_clerk)
        meeting = self.make(organiser=self.elder, level="synod", branch=None, attendees=[self.elder_b1])
        self.assertEqual(self.as_(self.elder_b1).get(detail(meeting)).status_code, 200)
        for user in (self.elder_a2, self.minister):
            with self.subTest(user=user.username):
                self.assertEqual(self.as_(user).get(detail(meeting)).status_code, 404)

    def test_the_organiser_still_manages_after_leaving_office(self):
        office = appoint(self.elder, self.session_clerk, branch=self.a1)
        meeting = self.make(organiser=self.elder)
        office.ended_on = timezone.localdate()
        office.save()
        response = self.as_(self.elder).patch(detail(meeting), {"venue": "Hall"}, format="json")
        self.assertEqual(response.status_code, 200)

    def test_a_branch_meeting_needs_exactly_its_branch(self):
        for body in (dict(branch=None), dict(presbytery="north")):
            with self.subTest(body=body):
                self.assertEqual(self.create(self.root, **body).status_code, 400)
        self.assertFalse(Meeting.objects.exists())

    def test_an_organiser_who_is_not_invited_has_no_answer_to_give(self):
        meeting = self.make()
        appoint(self.elder, self.session_clerk, branch=self.a1)
        response = self.as_(self.elder).post(detail(meeting, "respond"), {"response": "attending"}, format="json")
        self.assertEqual(response.status_code, 404)

    def test_the_list_says_which_meetings_have_started(self):
        self.make(starts_at=timezone.now() - timedelta(hours=1), attendees=[self.elder])
        self.make(attendees=[self.elder])
        rows = self.as_(self.elder).get(LIST + "?when=all").data["results"]
        self.assertEqual([row["has_started"] for row in rows], [True, False])
