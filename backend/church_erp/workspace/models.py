"""The shared workspace (AGENT_EXECUTION_PLAN.md, Phase 8).

Task 8.1: the offices people hold. A `Position` is a kind of office at one level
(branch, presbytery or synod), such as Session Clerk or Treasurer. Positions are
data, so new ones are added in the dashboard without code. An `Appointment` says
who holds a position at one place, and when they stopped holding it."""
from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone

from church_erp.core.models import Branch, Presbytery

BRANCH, PRESBYTERY, SYNOD = "branch", "presbytery", "synod"
LEVELS = [(BRANCH, "Branch"), (PRESBYTERY, "Presbytery"), (SYNOD, "Synod")]


class Position(models.Model):
    name = models.CharField(max_length=80)
    level = models.CharField(max_length=12, choices=LEVELS)
    can_organise = models.BooleanField(
        default=False, help_text="Holders may plan meetings at their branch, presbytery or the synod.",
    )
    single_holder = models.BooleanField(default=True, help_text="Only one person holds it at a place at a time.")
    order = models.PositiveSmallIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["level", "order", "name"]
        constraints = [models.UniqueConstraint(fields=["level", "name"], name="unique_position_per_level")]

    def __str__(self):
        return f"{self.name} ({self.get_level_display()})"


def appointment_problem(person, position, branch, presbytery):
    """Why this appointment can't be made, or None. The same rule for the API and the admin."""
    if position.level == BRANCH:
        if branch is None or presbytery is not None:
            return "Choose the branch this position is at."
        if person.branch_id != branch.pk:
            return "Only someone from this branch can hold one of its positions."
    elif position.level == PRESBYTERY:
        if presbytery is None or branch is not None:
            return "Choose the presbytery this position is at."
        if person.branch is None or person.branch.presbytery_id != presbytery.pk:
            return "Only someone from a branch in this presbytery can hold one of its positions."
    elif branch is not None or presbytery is not None:
        return "Synod positions aren't tied to a branch or presbytery."
    if person.is_superuser or not person.is_active:
        return "This account can't hold a position."
    return None


class AppointmentQuerySet(models.QuerySet):
    def current(self):
        return self.filter(ended_on__isnull=True)


class Appointment(models.Model):
    person = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="appointments")
    position = models.ForeignKey(Position, on_delete=models.PROTECT, related_name="appointments")
    branch = models.ForeignKey(Branch, on_delete=models.CASCADE, null=True, blank=True, related_name="appointments")
    presbytery = models.ForeignKey(
        Presbytery, on_delete=models.CASCADE, null=True, blank=True, related_name="appointments",
    )
    started_on = models.DateField(default=timezone.localdate)
    ended_on = models.DateField(null=True, blank=True)
    appointed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    objects = AppointmentQuerySet.as_manager()

    class Meta:
        ordering = ["position__level", "position__order", "-started_on"]

    def __str__(self):
        return f"{self.person} — {self.title}"

    @property
    def place(self):
        return self.branch or self.presbytery

    @property
    def title(self):
        if self.position.level == SYNOD:
            return f"Synod {self.position.name}"
        return f"{self.position.name}, {self.place.name}" if self.place else self.position.name

    def clean(self):
        super().clean()
        problem = appointment_problem(self.person, self.position, self.branch, self.presbytery)
        if problem:
            raise ValidationError(problem)


class Notification(models.Model):
    """Something for one person to know (Task 8.2): shown under the bell in the dashboard,
    and later sent to their phone (Task 8.7). Only ever read by its own person."""
    KINDS = [
        ("meeting_invited", "Added to a meeting"),
        ("meeting_changed", "Meeting changed"),
        ("meeting_cancelled", "Meeting cancelled"),
        ("deliverable_assigned", "Something to prepare"),
        ("deliverable_submitted", "Something was submitted"),
        ("deliverable_reviewed", "Your submission was reviewed"),
        ("document_shared", "A document was shared with you"),
    ]
    person = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notifications")
    kind = models.CharField(max_length=30, choices=KINDS)
    text = models.CharField(max_length=300)
    link = models.CharField(max_length=300, blank=True, help_text="A page in the dashboard, starting with /dashboard/")
    created_at = models.DateTimeField(auto_now_add=True)
    read_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at", "-pk"]
        indexes = [models.Index(fields=["person", "read_at"])]

    def __str__(self):
        return f"{self.person}: {self.text}"


class Meeting(models.Model):
    """A meeting at a branch, a presbytery or the synod (Task 8.3)."""
    SCHEDULED, CANCELLED, HELD = "scheduled", "cancelled", "held"
    STATUSES = [(SCHEDULED, "Scheduled"), (CANCELLED, "Cancelled"), (HELD, "Held")]

    title = models.CharField(max_length=200)
    level = models.CharField(max_length=12, choices=LEVELS)
    branch = models.ForeignKey(Branch, on_delete=models.CASCADE, null=True, blank=True, related_name="meetings")
    presbytery = models.ForeignKey(Presbytery, on_delete=models.CASCADE, null=True, blank=True, related_name="meetings")
    starts_at = models.DateTimeField()
    ends_at = models.DateTimeField(null=True, blank=True)
    venue = models.CharField(max_length=200, blank=True)
    online_link = models.URLField(blank=True, help_text="A video call's https address, if any")
    agenda = models.TextField(blank=True, max_length=4000)
    organiser = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="+")
    status = models.CharField(max_length=10, choices=STATUSES, default=SCHEDULED)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["starts_at", "pk"]
        indexes = [models.Index(fields=["starts_at"])]

    def __str__(self):
        return f"{self.title} ({self.starts_at:%d %b %Y})"

    @property
    def place(self):
        return self.branch or self.presbytery


class MeetingAttendee(models.Model):
    NO_REPLY, ATTENDING, APOLOGIES = "pending", "attending", "apologies"
    RESPONSES = [(NO_REPLY, "No reply yet"), (ATTENDING, "Attending"), (APOLOGIES, "Sending apologies")]

    meeting = models.ForeignKey(Meeting, on_delete=models.CASCADE, related_name="attendees")
    person = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="meeting_places")
    response = models.CharField(max_length=10, choices=RESPONSES, default=NO_REPLY)
    present = models.BooleanField(null=True, blank=True, help_text="Recorded after the meeting")
    added_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["person__first_name", "person__last_name", "person__username"]
        constraints = [models.UniqueConstraint(fields=["meeting", "person"], name="one_place_per_person")]


class CalendarFeed(models.Model):
    """A private address a phone's calendar can subscribe to (Task 8.3, A7). Only a hash
    of its secret is kept; making a new one replaces the old."""
    person = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="calendar_feed")
    token_hash = models.CharField(max_length=64, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)


class Deliverable(models.Model):
    """Something one person must bring to a meeting by a date (R4, A4)."""
    TO_DO, SUBMITTED, ACCEPTED, CHANGES = "todo", "submitted", "accepted", "changes"
    STATUSES = [(TO_DO, "To do"), (SUBMITTED, "Submitted"), (ACCEPTED, "Accepted"), (CHANGES, "Needs changes")]
    OPEN = (TO_DO, CHANGES)

    meeting = models.ForeignKey(Meeting, on_delete=models.CASCADE, related_name="deliverables")
    title = models.CharField(max_length=200)
    notes = models.TextField(blank=True, max_length=1000)
    assignee = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
                                 related_name="deliverables")
    # Where it came from, so a handover can pass it to the office's next holder (A9).
    position = models.ForeignKey(Position, on_delete=models.SET_NULL, null=True, blank=True, related_name="+")
    due_on = models.DateField()
    status = models.CharField(max_length=10, choices=STATUSES, default=TO_DO)
    submitted_note = models.TextField(blank=True, max_length=1000)
    submitted_at = models.DateTimeField(null=True, blank=True)
    review_note = models.TextField(blank=True, max_length=1000)
    reviewed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
                                    related_name="+")
    reviewed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["due_on", "pk"]
        indexes = [models.Index(fields=["assignee", "status"])]

    def __str__(self):
        return self.title


class MeetingTemplate(models.Model):
    """A routine meeting's usual deliverables, e.g. a Session meeting's minutes and reports (R4)."""
    name = models.CharField(max_length=100)
    level = models.CharField(max_length=12, choices=LEVELS)
    is_active = models.BooleanField(default=True)
    order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["level", "order", "name"]
        constraints = [models.UniqueConstraint(fields=["level", "name"], name="one_template_name_per_level")]

    def __str__(self):
        return self.name


class TemplateItem(models.Model):
    """One usual deliverable: what, who usually prepares it, and how many days before the meeting."""
    template = models.ForeignKey(MeetingTemplate, on_delete=models.CASCADE, related_name="items")
    title = models.CharField(max_length=200)
    position = models.ForeignKey(Position, on_delete=models.SET_NULL, null=True, blank=True, related_name="+")
    for_minister = models.BooleanField(default=False, help_text="The branch's minister prepares it")
    days_before = models.PositiveSmallIntegerField(default=7)
    order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["order", "pk"]

    def __str__(self):
        return self.title
