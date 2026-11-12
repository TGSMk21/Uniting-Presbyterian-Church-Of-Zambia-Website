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
