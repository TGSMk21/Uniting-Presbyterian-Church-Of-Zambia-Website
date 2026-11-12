"""Deliverables, meeting checklists and the reminder list (AGENT_EXECUTION_PLAN.md, Task 8.4).

A deliverable belongs to a meeting: whoever can see the meeting sees it, the meeting's
organisers add, change, remove and review it, and only its person submits it."""
from datetime import timedelta

from django.db import transaction
from django.utils import timezone
from rest_framework import permissions, serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView

from church_erp.accounts.models import User

from . import scopes
from .meetings import add_attendees, can_manage, link_to, meeting_summary, place_title, visible_meetings
from .models import (BRANCH, LEVELS, PRESBYTERY, SYNOD, Appointment, Deliverable, Meeting, MeetingAttendee,
                     MeetingTemplate, Position, TemplateItem)
from .notify import notify
from .structure_views import IsWorkspaceMember, members, person_name

MAX_DAYS_BEFORE = 90


# --- Who prepares what ------------------------------------------------------------------

def minister_of(branch):
    if branch is None:
        return None
    return (User.objects.filter(role=scopes.MINISTER_ROLE, branch=branch, is_active=True, is_superuser=False)
            .order_by("pk").first())


def holder(position, meeting):
    """Who currently holds `position` at the meeting's own place, if anyone."""
    rows = Appointment.objects.current().filter(position=position).select_related("person")
    if position.level == BRANCH:
        rows = rows.filter(branch=meeting.branch)
    elif position.level == PRESBYTERY:
        rows = rows.filter(presbytery=meeting.presbytery)
    row = rows.order_by("-started_on", "-pk").first()
    return row.person if row and scopes.is_member(row.person) else None


def due_text(row):
    return row.due_on.strftime("%a %d %b")


def tell_assigned(rows, actor):
    for row in rows:
        if row.assignee is not None:
            notify([row.assignee], "deliverable_assigned",
                   f"Please prepare {row.title} for {row.meeting.title} by {due_text(row)}",
                   link_to(row.meeting), actor=actor)


def take_part(meeting, people):
    """Whoever must deliver for a meeting can open it."""
    add_attendees(meeting, [person for person in people if person is not None])


def apply_template(meeting, template, actor):
    if template.level != meeting.level:
        raise serializers.ValidationError({"template": ["This checklist is for a different kind of meeting."]})
    meeting_day = timezone.localtime(meeting.starts_at).date()
    rows = []
    for item in template.items.select_related("position"):
        if item.for_minister:
            person = minister_of(meeting.branch) if meeting.level == BRANCH else None
        else:
            person = holder(item.position, meeting) if item.position else None
        rows.append(Deliverable(meeting=meeting, title=item.title, assignee=person, position=item.position,
                                due_on=meeting_day - timedelta(days=item.days_before)))
    with transaction.atomic():
        Deliverable.objects.bulk_create(rows)
        take_part(meeting, {row.assignee for row in rows})
    tell_assigned(rows, actor)
    return rows


def hand_over(position, branch, presbytery, person, actor):
    """A9: an office's open work for meetings still to come passes to its new holder."""
    rows = Deliverable.objects.filter(position=position, status__in=Deliverable.OPEN, meeting__status=Meeting.SCHEDULED,
                                      meeting__starts_at__gte=timezone.now(), meeting__level=position.level)
    if position.level == BRANCH:
        rows = rows.filter(meeting__branch=branch)
    elif position.level == PRESBYTERY:
        rows = rows.filter(meeting__presbytery=presbytery)
    moved = list(rows.exclude(assignee=person).select_related("meeting"))
    for row in moved:
        row.assignee = person
        row.save(update_fields=["assignee"])
        take_part(row.meeting, [person])
    tell_assigned(moved, actor)


# --- Answers ---------------------------------------------------------------------------

def is_overdue(row, today=None):
    return row.status in Deliverable.OPEN and row.due_on < (today or timezone.localdate())


def deliverable_row(row, user):
    return {
        "id": row.pk, "title": row.title, "notes": row.notes,
        "assignee": {"id": row.assignee_id, "name": person_name(row.assignee)} if row.assignee else None,
        "due_on": row.due_on, "status": row.status, "overdue": is_overdue(row),
        "submitted_note": row.submitted_note, "submitted_at": row.submitted_at, "review_note": row.review_note,
        "is_mine": row.assignee_id == user.pk,
    }


def with_meeting(row, user):
    meeting = row.meeting
    return {**deliverable_row(row, user), "meeting": {"id": meeting.pk, "title": meeting.title,
                                                      "starts_at": meeting.starts_at, "place_title": place_title(meeting)}}


def meeting_deliverables(meeting, user):
    return [deliverable_row(row, user) for row in meeting.deliverables.select_related("assignee")]


def my_open_work(user):
    return (Deliverable.objects.filter(assignee=user, status__in=Deliverable.OPEN)
            .exclude(meeting__status=Meeting.CANCELLED).select_related("meeting__branch", "meeting__presbytery"))


def waiting_for_review(user):
    rows = (Deliverable.objects.filter(status=Deliverable.SUBMITTED, meeting__in=visible_meetings(user))
            .exclude(meeting__status=Meeting.CANCELLED)
            .select_related("assignee", "meeting__branch", "meeting__presbytery", "meeting__organiser"))
    return [row for row in rows if can_manage(user, row.meeting)]


# --- The API ---------------------------------------------------------------------------

class PersonField(serializers.PrimaryKeyRelatedField):
    default_error_messages = {"does_not_exist": "Choose someone who uses the shared workspace."}

    def get_queryset(self):
        return members()


class DeliverableSerializer(serializers.ModelSerializer):
    meeting = serializers.PrimaryKeyRelatedField(queryset=Meeting.objects.none())
    assignee = PersonField(required=False, allow_null=True)

    class Meta:
        model = Deliverable
        fields = ["meeting", "title", "notes", "assignee", "due_on"]
        extra_kwargs = {"title": {"allow_blank": False}}

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if self.instance is not None:
            self.fields.pop("meeting")      # a deliverable stays with its meeting
        else:
            self.fields["meeting"].queryset = visible_meetings(self.context["request"].user)


class DeliverableViewSet(viewsets.ModelViewSet):
    permission_classes = [IsWorkspaceMember]
    serializer_class = DeliverableSerializer
    pagination_class = None
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def get_queryset(self):
        return (Deliverable.objects.filter(meeting__in=visible_meetings(self.request.user))
                .select_related("assignee", "meeting__branch", "meeting__presbytery", "meeting__organiser"))

    def managed(self):
        row = self.get_object()
        if not can_manage(self.request.user, row.meeting):
            raise PermissionDenied("Only the meeting's organisers can do this.")
        return row

    def list(self, request, *args, **kwargs):
        user, params = request.user, request.query_params
        if params.get("mine") == "1":
            rows = my_open_work(user)[:100]
        elif params.get("review") == "1":
            rows = waiting_for_review(user)[:100]
        elif str(params.get("meeting", "")).isdigit():
            rows = self.get_queryset().filter(meeting_id=int(params["meeting"]))
        else:
            rows = my_open_work(user)[:100]
        return Response([with_meeting(row, user) for row in rows])

    def retrieve(self, request, *args, **kwargs):
        return Response(with_meeting(self.get_object(), request.user))

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        meeting = serializer.validated_data["meeting"]
        if not can_manage(request.user, meeting):
            raise PermissionDenied("Only the meeting's organisers can add deliverables.")
        with transaction.atomic():
            row = serializer.save()
            take_part(meeting, [row.assignee])
        tell_assigned([row], request.user)
        return Response(with_meeting(row, request.user), status=status.HTTP_201_CREATED)

    def partial_update(self, request, *args, **kwargs):
        row = self.managed()
        before = row.assignee_id
        serializer = self.get_serializer(row, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        with transaction.atomic():
            row = serializer.save()
            if row.assignee_id != before:
                take_part(row.meeting, [row.assignee])
        if row.assignee_id != before:
            tell_assigned([row], request.user)
        return Response(with_meeting(row, request.user))

    def destroy(self, request, *args, **kwargs):
        self.managed().delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["post"])
    def submit(self, request, *args, **kwargs):
        row = self.get_object()
        if row.assignee_id != request.user.pk:
            raise PermissionDenied("Only the person preparing it can hand it in.")
        if row.status not in Deliverable.OPEN:
            raise serializers.ValidationError({"status": ["This has already been handed in."]})
        row.status, row.submitted_at = Deliverable.SUBMITTED, timezone.now()
        row.submitted_note = str(request.data.get("note", ""))[:1000]
        row.save(update_fields=["status", "submitted_at", "submitted_note"])
        if row.meeting.organiser:
            notify([row.meeting.organiser], "deliverable_submitted",
                   f"{person_name(request.user)} handed in {row.title} for {row.meeting.title}",
                   link_to(row.meeting), actor=request.user)
        return Response(with_meeting(row, request.user))

    @action(detail=True, methods=["post"])
    def review(self, request, *args, **kwargs):
        row = self.managed()
        decision, note = request.data.get("decision"), str(request.data.get("note", "")).strip()[:1000]
        if row.status != Deliverable.SUBMITTED:
            raise serializers.ValidationError({"status": ["Only something handed in can be reviewed."]})
        if decision not in ("accept", "changes"):
            raise serializers.ValidationError({"decision": ["Accept it, or send it back for changes."]})
        if decision == "changes" and not note:
            raise serializers.ValidationError({"note": ["Say what needs changing."]})
        row.status = Deliverable.ACCEPTED if decision == "accept" else Deliverable.CHANGES
        row.review_note, row.reviewed_by, row.reviewed_at = note, request.user, timezone.now()
        row.save(update_fields=["status", "review_note", "reviewed_by", "reviewed_at"])
        if row.assignee:
            text = (f"{row.title} for {row.meeting.title} was accepted" if decision == "accept"
                    else f"{row.title} for {row.meeting.title} needs changes: {note}")
            notify([row.assignee], "deliverable_reviewed", text[:300], link_to(row.meeting), actor=request.user)
        return Response(with_meeting(row, request.user))


# --- Checklists (templates) ----------------------------------------------------------

class TemplateItemSerializer(serializers.ModelSerializer):
    position = serializers.PrimaryKeyRelatedField(queryset=Position.objects.filter(is_active=True), required=False,
                                                  allow_null=True)
    days_before = serializers.IntegerField(min_value=0, max_value=MAX_DAYS_BEFORE, default=7)

    class Meta:
        model = TemplateItem
        fields = ["title", "position", "for_minister", "days_before"]
        extra_kwargs = {"title": {"allow_blank": False}}


class TemplateSerializer(serializers.ModelSerializer):
    items = TemplateItemSerializer(many=True, required=False)

    class Meta:
        model = MeetingTemplate
        fields = ["name", "level", "is_active", "items"]

    def validate(self, attrs):
        level = attrs.get("level", getattr(self.instance, "level", None))
        problems = []
        for index, item in enumerate(attrs.get("items") or []):
            position = item.get("position")
            if position is not None and item.get("for_minister"):
                problems.append(f"Line {index + 1}: choose an office or the minister, not both.")
            elif position is not None and position.level != level:
                problems.append(f"Line {index + 1}: {position.name} isn't an office at this level.")
            elif item.get("for_minister") and level != BRANCH:
                problems.append(f"Line {index + 1}: only a branch meeting has its own minister.")
        if problems:
            raise serializers.ValidationError({"items": problems})
        return attrs

    def save_items(self, template, items):
        if items is None:
            return
        template.items.all().delete()
        TemplateItem.objects.bulk_create([TemplateItem(template=template, order=index, **item)
                                          for index, item in enumerate(items, start=1)])

    def create(self, validated_data):
        items = validated_data.pop("items", [])
        with transaction.atomic():
            template = MeetingTemplate.objects.create(**validated_data)
            self.save_items(template, items)
        return template

    def update(self, instance, validated_data):
        items = validated_data.pop("items", None)
        with transaction.atomic():
            instance = super().update(instance, validated_data)
            self.save_items(instance, items)
        return instance


def template_row(template):
    def who(item):
        if item.for_minister:
            return "Minister"
        return item.position.name if item.position else "Someone you choose"
    return {
        "id": template.pk, "name": template.name, "level": template.level, "is_active": template.is_active,
        "items": [{"title": i.title, "position": i.position_id, "for_minister": i.for_minister, "who": who(i),
                   "days_before": i.days_before} for i in template.items.select_related("position")],
    }


class SuperuserWrites(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.method in permissions.SAFE_METHODS or bool(request.user and request.user.is_superuser)


class TemplateViewSet(viewsets.ModelViewSet):
    permission_classes = [IsWorkspaceMember, SuperuserWrites]
    serializer_class = TemplateSerializer
    pagination_class = None
    http_method_names = ["get", "post", "patch", "head", "options"]

    def get_queryset(self):
        rows = MeetingTemplate.objects.prefetch_related("items__position")
        if not self.request.user.is_superuser:
            rows = rows.filter(is_active=True)
        level = self.request.query_params.get("level")
        return rows.filter(level=level) if level in dict(LEVELS) else rows

    def list(self, request, *args, **kwargs):
        return Response([template_row(t) for t in self.get_queryset()])

    def retrieve(self, request, *args, **kwargs):
        return Response(template_row(self.get_object()))

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return Response(template_row(serializer.save()), status=status.HTTP_201_CREATED)

    def partial_update(self, request, *args, **kwargs):
        serializer = self.get_serializer(self.get_object(), data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        return Response(template_row(serializer.save()))


# --- The Overview's reminder list (Task 8.2, A6) ------------------------------------

class AttentionView(APIView):
    """What needs me now: meetings this week, answers owed, work due, work to review."""
    permission_classes = [IsWorkspaceMember]

    def get(self, request):
        user, now = request.user, timezone.now()
        mine = MeetingAttendee.objects.filter(person=user, meeting__status=Meeting.SCHEDULED,
                                              meeting__starts_at__gte=now).select_related("meeting")
        week = [row for row in mine.filter(meeting__starts_at__lt=now + timedelta(days=7))
                .select_related("meeting__branch", "meeting__presbytery", "meeting__organiser")
                .order_by("meeting__starts_at")[:5]]
        return Response({
            "meetings": [meeting_summary(row.meeting, user, attendee=row) for row in week],
            "answer_needed": mine.filter(response=MeetingAttendee.NO_REPLY).count(),
            "deliverables": [with_meeting(row, user) for row in my_open_work(user)[:5]],
            "to_review": len(waiting_for_review(user)),
        })
