"""Deliverables, meeting checklists (templates) and the reminder list (Task 8.4, and 8.2's Overview items)."""
from datetime import timedelta

from django.core.cache import cache
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase

from church_erp.workspace.models import (Deliverable, Meeting, MeetingAttendee, MeetingTemplate, Notification,
                                         Position, TemplateItem)

from .helpers import appoint, build_synod

DELIVERABLES = reverse("workspace-deliverables-list")
TEMPLATES = reverse("workspace-templates-list")
ATTENTION = reverse("workspace-attention")


def one(row, name="detail"):
    return reverse(f"workspace-deliverables-{name}", args=[row.pk])


class DeliverableTestCase(APITestCase):
    def setUp(self):
        cache.clear()
        self.addCleanup(cache.clear)
        build_synod(self)
        self.when = timezone.now() + timedelta(days=10)
        self.meeting = self.meet()

    def as_(self, user):
        self.client.force_authenticate(user)
        return self.client

    def meet(self, organiser=None, attendees=(), level="branch", branch="a1", presbytery=None, **extra):
        organiser = organiser or self.minister
        meeting = Meeting.objects.create(
            title=extra.pop("title", "Session meeting"), level=level,
            branch=getattr(self, branch) if branch else None, presbytery=presbytery,
            starts_at=extra.pop("starts_at", self.when), organiser=organiser, **extra)
        for person in (organiser, *attendees):
            MeetingAttendee.objects.get_or_create(meeting=meeting, person=person)
        return meeting

    def task(self, assignee=None, meeting=None, **extra):
        return Deliverable.objects.create(meeting=meeting or self.meeting, title=extra.pop("title", "Minutes"),
                                          assignee=assignee or self.elder,
                                          due_on=extra.pop("due_on", timezone.localdate() + timedelta(days=7)),
                                          **extra)

    def add(self, user, **body):
        values = {"meeting": self.meeting.pk, "title": "Financial report", "assignee": self.elder.pk,
                  "due_on": (timezone.localdate() + timedelta(days=5)).isoformat(), **body}
        return self.as_(user).post(DELIVERABLES, values, format="json")


class TemplateTests(DeliverableTestCase):
    def test_the_routine_checklists_are_ready(self):
        session = MeetingTemplate.objects.get(name="Session meeting", level="branch")
        self.assertEqual([(i.title, i.position.name if i.position else None, i.for_minister)
                          for i in session.items.all()],
                         [("Minutes of the last meeting", "Session Clerk", False),
                          ("Financial report", "Treasurer", False), ("Minister's report", None, True)])
        self.assertTrue(MeetingTemplate.objects.filter(level="presbytery").exists())
        self.assertTrue(MeetingTemplate.objects.filter(level="synod").exists())

    def test_members_read_checklists_and_only_the_superuser_changes_them(self):
        data = self.as_(self.minister).get(TEMPLATES + "?level=branch").data
        self.assertEqual([t["name"] for t in data], ["Session meeting"])
        self.assertEqual(data[0]["items"][2]["who"], "Minister")
        self.assertEqual(self.as_(self.editor).get(TEMPLATES).status_code, 403)
        body = {"name": "Finance committee", "level": "branch",
                "items": [{"title": "Budget", "position": self.treasurer.pk, "days_before": 5}]}
        self.assertEqual(self.as_(self.minister).post(TEMPLATES, body, format="json").status_code, 403)
        response = self.as_(self.root).post(TEMPLATES, body, format="json")
        self.assertEqual(response.status_code, 201, response.data)
        template = MeetingTemplate.objects.get(name="Finance committee")
        self.assertEqual(template.items.get().position, self.treasurer)

    def test_saving_a_checklist_replaces_its_lines(self):
        session = MeetingTemplate.objects.get(name="Session meeting")
        url = reverse("workspace-templates-detail", args=[session.pk])
        body = {"items": [{"title": "Minutes", "position": self.session_clerk.pk, "days_before": 2},
                          {"title": "Minister's report", "for_minister": True, "days_before": 1}]}
        self.assertEqual(self.as_(self.root).patch(url, body, format="json").status_code, 200)
        self.assertEqual([i.title for i in session.items.all()], ["Minutes", "Minister's report"])

    def test_a_line_names_one_office_at_the_checklists_level_or_the_minister(self):
        presbytery_clerk = self.presbytery_clerk
        bad = [
            {"title": "X", "position": presbytery_clerk.pk},            # a presbytery office on a branch list
            {"title": "X", "position": self.treasurer.pk, "for_minister": True},
            {"title": "", "position": self.treasurer.pk},
            {"title": "X", "position": self.treasurer.pk, "days_before": 400},
        ]
        for item in bad:
            with self.subTest(item=item):
                body = {"name": "Bad", "level": "branch", "items": [item]}
                self.assertEqual(self.as_(self.root).post(TEMPLATES, body, format="json").status_code, 400)
        body = {"name": "Bad", "level": "synod", "items": [{"title": "X", "for_minister": True}]}
        self.assertEqual(self.as_(self.root).post(TEMPLATES, body, format="json").status_code, 400)


class ApplyTests(DeliverableTestCase):
    def apply(self, user, meeting=None, template=None):
        template = template or MeetingTemplate.objects.get(name="Session meeting")
        url = reverse("workspace-meetings-apply-template", args=[(meeting or self.meeting).pk])
        return self.as_(user).post(url, {"template": template.pk}, format="json")

    def test_a_checklist_gives_each_office_holder_their_deliverable(self):
        appoint(self.elder, self.session_clerk, branch=self.a1)
        response = self.apply(self.minister)
        self.assertEqual(response.status_code, 200, response.data)
        rows = {d.title: d for d in self.meeting.deliverables.all()}
        self.assertEqual(rows["Minutes of the last meeting"].assignee, self.elder)
        self.assertEqual(rows["Minutes of the last meeting"].position, self.session_clerk)
        self.assertEqual(rows["Minutes of the last meeting"].due_on, timezone.localtime(self.when).date() - timedelta(days=3))
        self.assertEqual(rows["Minister's report"].assignee, self.minister)
        # Nobody is Treasurer yet: the line waits for the organiser to choose someone.
        self.assertIsNone(rows["Financial report"].assignee)
        # The clerk is now on the meeting, and told about the work.
        self.assertTrue(self.meeting.attendees.filter(person=self.elder).exists())
        note = Notification.objects.get(person=self.elder, kind="deliverable_assigned")
        self.assertIn("Minutes of the last meeting", note.text)
        self.assertFalse(Notification.objects.filter(person=self.minister).exists())

    def test_offices_are_those_of_the_meetings_own_place(self):
        appoint(self.elder_a2, self.session_clerk, branch=self.a2)
        self.apply(self.minister)
        self.assertIsNone(self.meeting.deliverables.get(title="Minutes of the last meeting").assignee)

    def test_a_presbytery_checklist_uses_that_presbyterys_offices(self):
        appoint(self.elder_a2, self.presbytery_clerk, presbytery=self.north)
        appoint(self.elder_b1, self.presbytery_clerk, presbytery=self.south)
        meeting = self.meet(organiser=self.elder_a2, level="presbytery", branch=None, presbytery=self.north)
        response = self.apply(self.elder_a2, meeting, MeetingTemplate.objects.get(name="Presbytery meeting"))
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(meeting.deliverables.get(title="Minutes of the last meeting").assignee, self.elder_a2)

    def test_the_checklist_must_suit_the_meetings_level_and_only_organisers_apply_it(self):
        self.assertEqual(self.apply(self.minister, template=MeetingTemplate.objects.get(name="Synod meeting"))
                         .status_code, 400)
        MeetingAttendee.objects.create(meeting=self.meeting, person=self.elder)
        self.assertEqual(self.apply(self.elder).status_code, 403)
        self.assertEqual(self.apply(self.elder_b1).status_code, 404)
        self.assertFalse(Deliverable.objects.exists())

    def test_planning_a_meeting_with_a_checklist(self):
        appoint(self.elder, self.session_clerk, branch=self.a1)
        template = MeetingTemplate.objects.get(name="Session meeting")
        body = {"title": "Session meeting", "level": "branch", "branch": "a1", "starts_at": self.when.isoformat(),
                "template": template.pk}
        response = self.as_(self.minister).post(reverse("workspace-meetings-list"), body, format="json")
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(len(response.data["deliverables"]), 3)

    def test_the_meeting_page_lists_its_deliverables(self):
        self.task(title="Minutes")
        data = self.as_(self.minister).get(reverse("workspace-meetings-detail", args=[self.meeting.pk])).data
        row = data["deliverables"][0]
        self.assertEqual(set(row), {"id", "title", "notes", "assignee", "due_on", "status", "overdue",
                                    "submitted_note", "submitted_at", "review_note", "is_mine", "document"})
        self.assertEqual(row["assignee"]["name"], "Elder")


class DeliverableRuleTests(DeliverableTestCase):
    def test_organisers_add_a_deliverable_and_the_person_is_told_and_invited(self):
        response = self.add(self.minister, notes="Up to the end of October")
        self.assertEqual(response.status_code, 201, response.data)
        row = Deliverable.objects.get()
        self.assertEqual((row.assignee, row.status), (self.elder, "todo"))
        self.assertTrue(self.meeting.attendees.filter(person=self.elder).exists())
        note = Notification.objects.get(person=self.elder)
        self.assertEqual((note.kind, note.link), ("deliverable_assigned", f"/dashboard/meetings/{self.meeting.pk}"))

    def test_only_organisers_add_and_only_for_workspace_members(self):
        MeetingAttendee.objects.create(meeting=self.meeting, person=self.elder)
        self.assertEqual(self.add(self.elder).status_code, 403)
        self.assertEqual(self.add(self.elder_b1).status_code, 400)       # can't see the meeting: no such meeting
        self.assertEqual(self.add(self.minister, assignee=self.editor.pk).status_code, 400)
        self.assertEqual(self.add(self.minister, title="").status_code, 400)
        self.assertFalse(Deliverable.objects.exists())

    def test_a_deliverable_may_be_left_for_later_without_a_person(self):
        response = self.add(self.minister, assignee=None)
        self.assertEqual(response.status_code, 201, response.data)
        self.assertFalse(Notification.objects.exists())

    def test_the_person_submits_and_the_organiser_is_told(self):
        row = self.task()
        MeetingAttendee.objects.create(meeting=self.meeting, person=self.elder)
        response = self.as_(self.elder).post(one(row, "submit"), {"note": "Attached to the email"}, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        row.refresh_from_db()
        self.assertEqual((row.status, row.submitted_note), ("submitted", "Attached to the email"))
        self.assertIsNotNone(row.submitted_at)
        self.assertEqual(Notification.objects.get(person=self.minister).kind, "deliverable_submitted")

    def test_only_the_person_submits_and_not_twice(self):
        row = self.task()
        MeetingAttendee.objects.create(meeting=self.meeting, person=self.elder)
        self.assertEqual(self.as_(self.minister).post(one(row, "submit"), {}, format="json").status_code, 403)
        self.assertEqual(self.as_(self.elder_b1).post(one(row, "submit"), {}, format="json").status_code, 404)
        self.as_(self.elder).post(one(row, "submit"), {}, format="json")
        self.assertEqual(self.as_(self.elder).post(one(row, "submit"), {}, format="json").status_code, 400)

    def test_the_organiser_accepts_or_asks_for_changes_with_a_reason(self):
        row = self.task(status="submitted")
        response = self.as_(self.minister).post(one(row, "review"), {"decision": "changes"}, format="json")
        self.assertEqual(response.status_code, 400)
        response = self.as_(self.minister).post(one(row, "review"), {"decision": "changes", "note": "Add October"},
                                                format="json")
        self.assertEqual(response.status_code, 200, response.data)
        row.refresh_from_db()
        self.assertEqual((row.status, row.review_note, row.reviewed_by), ("changes", "Add October", self.minister))
        note = Notification.objects.get(person=self.elder)
        self.assertEqual(note.kind, "deliverable_reviewed")
        # Sent back, it can be submitted again, then accepted.
        MeetingAttendee.objects.create(meeting=self.meeting, person=self.elder)
        self.as_(self.elder).post(one(row, "submit"), {}, format="json")
        self.as_(self.minister).post(one(row, "review"), {"decision": "accept"}, format="json")
        row.refresh_from_db()
        self.assertEqual(row.status, "accepted")

    def test_only_organisers_review_and_only_what_was_submitted(self):
        row = self.task()
        self.assertEqual(self.as_(self.minister).post(one(row, "review"), {"decision": "accept"}, format="json")
                         .status_code, 400)
        row.status = "submitted"
        row.save()
        MeetingAttendee.objects.create(meeting=self.meeting, person=self.elder)
        self.assertEqual(self.as_(self.elder).post(one(row, "review"), {"decision": "accept"}, format="json")
                         .status_code, 403)
        self.assertEqual(self.as_(self.minister).post(one(row, "review"), {"decision": "maybe"}, format="json")
                         .status_code, 400)

    def test_changing_the_person_tells_the_new_one(self):
        row = self.task()
        response = self.as_(self.minister).patch(one(row), {"assignee": self.elder_a2.pk}, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(Notification.objects.get(person=self.elder_a2).kind, "deliverable_assigned")
        self.assertTrue(self.meeting.attendees.filter(person=self.elder_a2).exists())
        # The meeting can't be swapped for another.
        other = self.meet()
        self.as_(self.minister).patch(one(row), {"meeting": other.pk}, format="json")
        row.refresh_from_db()
        self.assertEqual(row.meeting, self.meeting)

    def test_only_organisers_change_or_remove(self):
        row = self.task()
        MeetingAttendee.objects.create(meeting=self.meeting, person=self.elder)
        self.assertEqual(self.as_(self.elder).patch(one(row), {"title": "X"}, format="json").status_code, 403)
        self.assertEqual(self.as_(self.elder).delete(one(row)).status_code, 403)
        self.assertEqual(self.as_(self.elder_b1).delete(one(row)).status_code, 404)
        self.assertEqual(self.as_(self.minister).delete(one(row)).status_code, 204)

    def test_my_list_shows_open_work_soonest_first_and_overdue(self):
        late = self.task(due_on=timezone.localdate() - timedelta(days=1), title="Late")
        soon = self.task(title="Soon")
        self.task(title="Done", status="accepted")
        self.task(title="Waiting", status="submitted")
        self.task(title="Theirs", assignee=self.elder_a2)
        cancelled = self.meet(status="cancelled")
        self.task(meeting=cancelled, title="Cancelled")
        rows = self.as_(self.elder).get(DELIVERABLES + "?mine=1").data
        self.assertEqual([r["id"] for r in rows], [late.pk, soon.pk])
        self.assertEqual([r["overdue"] for r in rows], [True, False])
        self.assertEqual(rows[0]["meeting"]["title"], "Session meeting")

    def test_the_organisers_review_list(self):
        waiting = self.task(status="submitted")
        self.task()
        elsewhere = self.meet(organiser=self.root, branch="b1")
        self.task(meeting=elsewhere, status="submitted", assignee=self.elder_b1)
        self.assertEqual([r["id"] for r in self.as_(self.minister).get(DELIVERABLES + "?review=1").data],
                         [waiting.pk])


class HandoverTests(DeliverableTestCase):
    def test_a_new_office_holder_takes_over_open_work(self):
        appoint(self.elder, self.session_clerk, branch=self.a1)
        open_row = self.task(position=self.session_clerk, title="Minutes")
        done = self.task(position=self.session_clerk, title="Old minutes", status="accepted")
        mine = self.task(title="Personal")
        past = self.meet(starts_at=timezone.now() - timedelta(days=3))
        old = self.task(meeting=past, position=self.session_clerk, title="Last month")
        other = self.meet(branch="a2", organiser=self.root)
        theirs = self.task(meeting=other, position=self.session_clerk, title="Other branch")
        response = self.as_(self.minister).post(reverse("workspace-appointments-list"),
                                                {"person": self.minister.pk, "position": self.session_clerk.pk,
                                                 "branch": "a1"}, format="json")
        self.assertEqual(response.status_code, 201, response.data)
        for row, who in ((open_row, self.minister), (done, self.elder), (mine, self.elder), (old, self.elder),
                         (theirs, self.elder)):
            row.refresh_from_db()
            with self.subTest(row=row.title):
                self.assertEqual(row.assignee, who)


class AttentionTests(DeliverableTestCase):
    def test_the_overview_gathers_what_needs_me(self):
        MeetingAttendee.objects.create(meeting=self.meeting, person=self.elder)
        soon = self.meet(starts_at=timezone.now() + timedelta(days=2), attendees=[self.elder], title="Soon")
        self.task(title="Report")
        data = self.as_(self.elder).get(ATTENTION).data
        self.assertEqual([m["id"] for m in data["meetings"]], [soon.pk])
        self.assertEqual(data["answer_needed"], 2)
        self.assertEqual([d["title"] for d in data["deliverables"]], ["Report"])
        self.assertEqual(data["to_review"], 0)
        waiting = self.task(status="submitted")
        self.assertEqual(self.as_(self.minister).get(ATTENTION).data["to_review"], 1)
        self.assertIsNotNone(waiting)

    def test_people_outside_the_workspace_get_nothing(self):
        self.assertEqual(self.as_(self.editor).get(ATTENTION).status_code, 403)


class SeedTests(DeliverableTestCase):
    def test_lines_follow_their_office(self):
        self.assertTrue(TemplateItem.objects.filter(position__in=Position.objects.filter(level="branch")).exists())


class GapTests(DeliverableTestCase):
    """Cases found by mutation checks."""

    def test_a_suspended_office_holder_is_not_given_work(self):
        appoint(self.elder, self.session_clerk, branch=self.a1)
        self.elder.is_active = False
        self.elder.save()
        url = reverse("workspace-meetings-apply-template", args=[self.meeting.pk])
        template = MeetingTemplate.objects.get(name="Session meeting")
        self.as_(self.minister).post(url, {"template": template.pk}, format="json")
        self.assertIsNone(self.meeting.deliverables.get(title="Minutes of the last meeting").assignee)

    def test_finished_work_is_never_overdue(self):
        self.task(due_on=timezone.localdate() - timedelta(days=2), status="accepted")
        data = self.as_(self.minister).get(reverse("workspace-meetings-detail", args=[self.meeting.pk])).data
        self.assertFalse(data["deliverables"][0]["overdue"])

    def test_attendees_who_dont_organise_have_nothing_to_review(self):
        MeetingAttendee.objects.create(meeting=self.meeting, person=self.elder_a2)
        self.task(status="submitted")
        self.assertEqual(self.as_(self.elder_a2).get(DELIVERABLES + "?review=1").data, [])
        self.assertEqual(self.as_(self.elder_a2).get(ATTENTION).data["to_review"], 0)

    def test_nobody_accepts_their_own_work(self):
        appoint(self.elder, self.session_clerk, branch=self.a1)
        row = self.task(status="submitted")      # the clerk's own minutes
        response = self.as_(self.elder).post(one(row, "review"), {"decision": "accept"}, format="json")
        self.assertEqual(response.status_code, 403)
        self.assertEqual(self.as_(self.elder).get(DELIVERABLES + "?review=1").data, [])
        self.assertEqual(self.as_(self.minister).post(one(row, "review"), {"decision": "accept"}, format="json")
                         .status_code, 200)


class ReviewFixTests(DeliverableTestCase):
    """Findings from the code review (Task 8.6)."""

    def test_work_given_to_someone_by_hand_stays_with_them_at_a_handover(self):
        appoint(self.elder, self.session_clerk, branch=self.a1)
        row = self.task(position=self.session_clerk)
        self.as_(self.minister).patch(one(row), {"assignee": self.elder_a2.pk}, format="json")
        self.as_(self.minister).post(reverse("workspace-appointments-list"),
                                     {"person": self.minister.pk, "position": self.session_clerk.pk, "branch": "a1"},
                                     format="json")
        row.refresh_from_db()
        self.assertEqual(row.assignee, self.elder_a2)

    def test_a_checklists_level_is_set_once(self):
        session = MeetingTemplate.objects.get(name="Session meeting")
        url = reverse("workspace-templates-detail", args=[session.pk])
        self.as_(self.root).patch(url, {"level": "synod"}, format="json")
        session.refresh_from_db()
        self.assertEqual(session.level, "branch")

    def test_the_review_count_stays_cheap(self):
        """The number of queries doesn't grow with the number of meetings."""
        from django.db import connection
        from django.test.utils import CaptureQueriesContext
        from church_erp.workspace.deliverables import waiting_for_review
        appoint(self.elder, self.session_clerk, branch=self.a1)

        def queries(count):
            for _ in range(count):
                self.task(meeting=self.meet(), status="submitted", assignee=self.elder_a2)
            with CaptureQueriesContext(connection) as seen:
                rows = waiting_for_review(self.elder)
            return len(rows), len(seen)

        few, few_queries = queries(2)
        many, many_queries = queries(6)
        self.assertEqual((few, many), (2, 8))
        self.assertEqual(few_queries, many_queries)

    def test_an_organiser_who_left_office_still_checks_work_for_their_meeting(self):
        office = appoint(self.elder, self.session_clerk, branch=self.a1)
        meeting = self.meet(organiser=self.elder)
        row = self.task(meeting=meeting, status="submitted", assignee=self.elder_a2)
        office.ended_on = timezone.localdate()
        office.save()
        from church_erp.workspace.deliverables import waiting_for_review
        self.assertEqual([r.pk for r in waiting_for_review(self.elder)], [row.pk])
