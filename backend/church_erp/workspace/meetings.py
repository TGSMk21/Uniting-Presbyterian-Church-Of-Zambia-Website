"""Meetings and the calendar (AGENT_EXECUTION_PLAN.md, Task 8.3).

A meeting is seen by its attendees and by whoever may organise meetings at its place
(decision D8.5), and managed by its organiser and those same organisers. Everyone
else gets "not found", so the API never confirms that someone else's meeting exists."""
import hashlib
import secrets
from datetime import datetime, time, timedelta, timezone as dt_timezone

from django.db import transaction
from django.db.models import Count, Q
from django.http import Http404, HttpResponse
from django.utils import timezone
from rest_framework import serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.pagination import PageNumberPagination
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView

from church_erp.core.models import Branch, Presbytery

from . import scopes
from .models import (BRANCH, LEVELS, PRESBYTERY, SYNOD, Appointment, CalendarFeed, Meeting, MeetingAttendee,
                     MeetingTemplate, Position)
from .notify import notify
from .structure_views import IsWorkspaceMember, members, person_name, place

DEFAULT_LENGTH = timedelta(hours=2)
CHANGES_TOLD = ("starts_at", "ends_at", "venue", "online_link")


# --- Who may see and manage -------------------------------------------------------------

def apply_template(meeting, template, actor):
    from .deliverables import apply_template as apply
    return apply(meeting, template, actor)


def meeting_deliverables(meeting, user):
    from .deliverables import meeting_deliverables as rows
    return rows(meeting, user)


def visible_meetings(user):
    if user.is_superuser:
        return Meeting.objects.all()
    places = scopes.organising_places(user)
    seen = Q(attendees__person=user) | Q(organiser=user)
    seen |= Q(level=BRANCH, branch__in=places["branches"]) | Q(level=PRESBYTERY, presbytery__in=places["presbyteries"])
    if places["synod"]:
        seen |= Q(level=SYNOD)
    return Meeting.objects.filter(pk__in=Meeting.objects.filter(seen).values("pk"))


def can_manage(user, meeting):
    if user.is_superuser or meeting.organiser_id == user.pk:
        return True
    return scopes.can_organise(user, meeting.level, branch=meeting.branch, presbytery=meeting.presbytery)


def place_title(meeting):
    if meeting.level == SYNOD:
        return "Synod of Zambia"
    if meeting.level == PRESBYTERY:
        return f"{meeting.presbytery.name} Presbytery" if meeting.presbytery else "Presbytery"
    return meeting.branch.name if meeting.branch else ""


# --- Serializers ------------------------------------------------------------------------

class PeopleIdsField(serializers.ListField):
    """Workspace members, by id."""
    child = serializers.IntegerField(min_value=1)

    def to_internal_value(self, data):
        ids = list(dict.fromkeys(super().to_internal_value(data)))[:200]
        people = list(members().filter(pk__in=ids))
        if len(people) != len(ids):
            raise serializers.ValidationError("Choose people who use the shared workspace.")
        return people


def https_only(value):
    if value and not value.lower().startswith("https://"):
        raise serializers.ValidationError("Use the call's full https:// address.")
    return value


class MeetingWriteSerializer(serializers.ModelSerializer):
    branch = serializers.SlugRelatedField(slug_field="slug", queryset=Branch.objects.filter(is_active=True),
                                          required=False, allow_null=True)
    presbytery = serializers.SlugRelatedField(slug_field="slug", queryset=Presbytery.objects.all(),
                                              required=False, allow_null=True)
    attendees = PeopleIdsField(required=False, write_only=True)
    template = serializers.PrimaryKeyRelatedField(queryset=MeetingTemplate.objects.filter(is_active=True),
                                                  required=False, allow_null=True, write_only=True)
    online_link = serializers.URLField(required=False, allow_blank=True, validators=[https_only])

    class Meta:
        model = Meeting
        fields = ["title", "level", "branch", "presbytery", "starts_at", "ends_at", "venue", "online_link", "agenda",
                  "attendees", "template"]
        extra_kwargs = {"title": {"allow_blank": False}}

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if self.instance is not None:
            # A meeting's level and place are set once.
            for name in ("level", "branch", "presbytery", "attendees", "template"):
                self.fields.pop(name)

    def validate(self, attrs):
        if self.instance is None:
            level, branch, presbytery = attrs["level"], attrs.get("branch"), attrs.get("presbytery")
            if level == BRANCH and (branch is None or presbytery is not None):
                raise serializers.ValidationError({"branch": ["Choose the branch the meeting is for."]})
            if level == PRESBYTERY and (presbytery is None or branch is not None):
                raise serializers.ValidationError({"presbytery": ["Choose the presbytery the meeting is for."]})
            if level == SYNOD and (branch is not None or presbytery is not None):
                raise serializers.ValidationError({"level": ["A synod meeting isn't for one branch or presbytery."]})
            template = attrs.get("template")
            if template is not None and template.level != level:
                raise serializers.ValidationError({"template": ["This checklist is for a different kind of meeting."]})
        starts = attrs.get("starts_at", getattr(self.instance, "starts_at", None))
        ends = attrs.get("ends_at", getattr(self.instance, "ends_at", None))
        if starts and ends and ends <= starts:
            raise serializers.ValidationError({"ends_at": ["The meeting must end after it starts."]})
        return attrs


def attendee_row(row):
    return {"id": row.person_id, "name": person_name(row.person), "branch": place(row.person.branch),
            "response": row.response, "present": row.present}


def meeting_summary(meeting, user, *, attendee=None):
    return {
        "id": meeting.pk, "title": meeting.title, "level": meeting.level,
        "branch": place(meeting.branch), "presbytery": place(meeting.presbytery), "place_title": place_title(meeting),
        "starts_at": meeting.starts_at, "ends_at": meeting.ends_at, "venue": meeting.venue,
        "online_link": meeting.online_link, "status": meeting.status,
        "organiser": {"id": meeting.organiser_id, "name": person_name(meeting.organiser)} if meeting.organiser else None,
        "my_response": attendee.response if attendee else None,
        "attendee_count": getattr(meeting, "attendee_count", None),
        "has_started": meeting.starts_at <= timezone.now(),
    }


# --- The API ----------------------------------------------------------------------------

def parse_day(value):
    try:
        return datetime.strptime(value, "%Y-%m-%d").date()
    except (TypeError, ValueError):
        return None


class MeetingPages(PageNumberPagination):
    page_size = 100     # a whole month at once, for the calendar


class MeetingViewSet(viewsets.ModelViewSet):
    permission_classes = [IsWorkspaceMember]
    pagination_class = MeetingPages
    http_method_names = ["get", "post", "patch", "head", "options"]

    def get_queryset(self):
        rows = visible_meetings(self.request.user).select_related("branch", "presbytery", "organiser").order_by("starts_at", "pk")
        if self.action != "list":
            return rows
        params, now = self.request.query_params, timezone.now()
        start, end = parse_day(params.get("from")), parse_day(params.get("to"))
        zone = timezone.get_current_timezone()
        if start and end and start <= end <= start + timedelta(days=62):
            rows = rows.filter(starts_at__gte=datetime.combine(start, time.min, zone),
                               starts_at__lt=datetime.combine(end + timedelta(days=1), time.min, zone))
        elif params.get("when") == "past":
            rows = rows.filter(starts_at__lt=now).order_by("-starts_at", "-pk")
        elif params.get("when") != "all":
            # Upcoming includes today's earlier meetings, so a meeting doesn't vanish while it's on.
            rows = rows.filter(starts_at__gte=timezone.localtime(now).replace(hour=0, minute=0, second=0, microsecond=0))
        if params.get("mine") == "1":
            rows = rows.filter(attendees__person=self.request.user)
        return rows.annotate(attendee_count=Count("attendees", distinct=True))

    def get_serializer_class(self):
        return MeetingWriteSerializer

    def managed(self):
        meeting = self.get_object()
        if not can_manage(self.request.user, meeting):
            raise PermissionDenied("Only the meeting's organisers can do this.")
        return meeting

    def list(self, request, *args, **kwargs):
        page = self.paginate_queryset(self.get_queryset())
        mine = {a.meeting_id: a for a in MeetingAttendee.objects.filter(person=request.user,
                                                                          meeting__in=[m.pk for m in page])}
        rows = [meeting_summary(m, request.user, attendee=mine.get(m.pk)) for m in page]
        return self.get_paginated_response(rows)

    def detail_answer(self, meeting):
        user = self.request.user
        rows = list(meeting.attendees.select_related("person__branch"))
        mine = next((row for row in rows if row.person_id == user.pk), None)
        return {
            **meeting_summary(meeting, user, attendee=mine), "attendee_count": len(rows),
            "agenda": meeting.agenda,
            "attendees": [attendee_row(row) for row in rows],
            "can_manage": can_manage(user, meeting),
            "is_organiser": meeting.organiser_id == user.pk,
            "deliverables": meeting_deliverables(meeting, user),
        }

    def retrieve(self, request, *args, **kwargs):
        return Response(self.detail_answer(self.get_object()))

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        values = dict(serializer.validated_data)
        if not scopes.can_organise(request.user, values["level"], branch=values.get("branch"),
                                   presbytery=values.get("presbytery")):
            raise PermissionDenied("You can't plan meetings there.")
        people = values.pop("attendees", [])
        template = values.pop("template", None)
        with transaction.atomic():
            meeting = Meeting.objects.create(organiser=request.user, **values)
            MeetingAttendee.objects.create(meeting=meeting, person=request.user, response=MeetingAttendee.ATTENDING)
            invited = add_attendees(meeting, people)
        tell_invited(meeting, invited, request.user)
        if template is not None:
            apply_template(meeting, template, request.user)
        return Response(self.detail_answer(meeting), status=status.HTTP_201_CREATED)

    def partial_update(self, request, *args, **kwargs):
        meeting = self.managed()
        before = {name: getattr(meeting, name) for name in CHANGES_TOLD}
        serializer = self.get_serializer(meeting, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        if meeting.status == Meeting.SCHEDULED and any(getattr(meeting, n) != before[n] for n in CHANGES_TOLD):
            notify(attendee_people(meeting), "meeting_changed",
                   f"{meeting.title} ({place_title(meeting)}) has changed: {when(meeting)}",
                   link_to(meeting), actor=request.user)
        return Response(self.detail_answer(meeting))

    @action(detail=True, methods=["post"])
    def cancel(self, request, *args, **kwargs):
        meeting = self.managed()
        if meeting.status != Meeting.CANCELLED:
            meeting.status = Meeting.CANCELLED
            meeting.save(update_fields=["status", "updated_at"])
            notify(attendee_people(meeting), "meeting_cancelled",
                   f"{meeting.title} on {when(meeting)} has been cancelled", link_to(meeting), actor=request.user)
        return Response(self.detail_answer(meeting))

    @action(detail=True, methods=["post"])
    def attendees(self, request, *args, **kwargs):
        meeting = self.managed()
        field = PeopleIdsField(required=False)
        add = field.run_validation(request.data.get("add", [])) if request.data.get("add") else []
        remove_ids = {int(i) for i in request.data.get("remove", []) if str(i).isdigit()}
        with transaction.atomic():
            invited = add_attendees(meeting, add)
            meeting.attendees.filter(person_id__in=remove_ids).exclude(person_id=meeting.organiser_id).delete()
        tell_invited(meeting, invited, request.user)
        return Response(self.detail_answer(meeting))

    @action(detail=True, methods=["post"])
    def respond(self, request, *args, **kwargs):
        meeting = self.get_object()
        answer = request.data.get("response")
        if answer not in (MeetingAttendee.ATTENDING, MeetingAttendee.APOLOGIES):
            raise serializers.ValidationError({"response": ["Answer Attending or Sending apologies."]})
        row = meeting.attendees.filter(person=request.user).first()
        if row is None:
            raise Http404
        row.response = answer
        row.save(update_fields=["response"])
        return Response(self.detail_answer(meeting))

    @action(detail=True, methods=["post"])
    def attendance(self, request, *args, **kwargs):
        meeting = self.managed()
        if meeting.starts_at > timezone.now():
            raise serializers.ValidationError({"present": ["Attendance is recorded once the meeting has started."]})
        present = {int(i) for i in request.data.get("present", []) if str(i).isdigit()}
        with transaction.atomic():
            for row in meeting.attendees.all():
                row.present = row.person_id in present
                row.save(update_fields=["present"])
            if meeting.status == Meeting.SCHEDULED:
                meeting.status = Meeting.HELD
                meeting.save(update_fields=["status", "updated_at"])
        return Response(self.detail_answer(meeting))

    @action(detail=True, methods=["post"])
    def copy(self, request, *args, **kwargs):
        meeting = self.managed()
        starts = serializers.DateTimeField().run_validation(request.data.get("starts_at"))
        length = (meeting.ends_at - meeting.starts_at) if meeting.ends_at else None
        with transaction.atomic():
            copy = Meeting.objects.create(
                title=meeting.title, level=meeting.level, branch=meeting.branch, presbytery=meeting.presbytery,
                starts_at=starts, ends_at=starts + length if length else None, venue=meeting.venue,
                online_link=meeting.online_link, agenda=meeting.agenda, organiser=request.user)
            MeetingAttendee.objects.create(meeting=copy, person=request.user, response=MeetingAttendee.ATTENDING)
            people = [row.person for row in meeting.attendees.select_related("person") if row.person.is_active]
            invited = add_attendees(copy, people)
        tell_invited(copy, invited, request.user)
        return Response(self.detail_answer(copy), status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="apply-template")
    def apply_template(self, request, *args, **kwargs):
        meeting = self.managed()
        template = serializers.PrimaryKeyRelatedField(queryset=MeetingTemplate.objects.filter(is_active=True)) \
            .run_validation(request.data.get("template"))
        apply_template(meeting, template, request.user)
        return Response(self.detail_answer(meeting))

    @action(detail=False, methods=["get"])
    def groups(self, request, *args, **kwargs):
        params = request.query_params
        level = params.get("level")
        if level not in dict(LEVELS):
            raise serializers.ValidationError({"level": ["Choose branch, presbytery or synod."]})
        branch = Branch.objects.filter(slug=params.get("branch", ""), is_active=True).first()
        presbytery = Presbytery.objects.filter(slug=params.get("presbytery", "")).first()
        return Response(invite_groups(level, branch, presbytery, leave_out=request.user))


# --- Helpers ----------------------------------------------------------------------------

def add_attendees(meeting, people):
    have = set(meeting.attendees.values_list("person_id", flat=True))
    new = [person for person in people if person.pk not in have]
    MeetingAttendee.objects.bulk_create([MeetingAttendee(meeting=meeting, person=person) for person in new])
    return new


def attendee_people(meeting):
    return [row.person for row in meeting.attendees.select_related("person")]


def when(meeting):
    return timezone.localtime(meeting.starts_at).strftime("%a %d %b, %H:%M")


def link_to(meeting):
    return f"/dashboard/meetings/{meeting.pk}"


def tell_invited(meeting, people, actor):
    if people and meeting.status == Meeting.SCHEDULED:
        notify(people, "meeting_invited", f"You're invited to {meeting.title} ({place_title(meeting)}) on {when(meeting)}",
               link_to(meeting), actor=actor)


def brief(person):
    return {"id": person.pk, "name": person_name(person), "branch": place(person.branch)}


def invite_groups(level, branch, presbytery, leave_out=None):
    """Ready-made groups for the attendee picker: e.g. "Session Clerks in Munali"."""
    people = members()
    held = Appointment.objects.current().select_related("person__branch", "position")
    groups = []

    def group(key, label, rows):
        rows = sorted({p.pk: p for p in rows if p != leave_out}.values(), key=person_name)
        if rows:
            groups.append({"key": key, "label": label, "people": [brief(p) for p in rows]})

    if level == BRANCH and branch is not None:
        group("everyone", f"Everyone at {branch.name}", people.filter(branch=branch))
        group("office-bearers", f"Office bearers at {branch.name}", [a.person for a in held.filter(branch=branch)])
    elif level == PRESBYTERY and presbytery is not None:
        local = people.filter(branch__presbytery=presbytery)
        name = f"{presbytery.name} Presbytery"
        group("office-bearers", f"{name} office bearers", [a.person for a in held.filter(presbytery=presbytery)])
        group("ministers", f"Ministers in {name}", local.filter(role=scopes.MINISTER_ROLE))
        for position in Position.objects.filter(is_active=True, level=BRANCH):
            group(f"position-{position.name}", f"{position.name}s in {name}",
                  [a.person for a in held.filter(position=position, branch__presbytery=presbytery)])
        group("everyone", f"Everyone in {name}", local)
    elif level == SYNOD:
        group("office-bearers", "Synod office bearers", [a.person for a in held.filter(position__level=SYNOD)])
        group("presbytery-office-bearers", "Presbytery office bearers",
              [a.person for a in held.filter(position__level=PRESBYTERY)])
        group("ministers", "All ministers", people.filter(role=scopes.MINISTER_ROLE))
        for position in Position.objects.filter(is_active=True, level=BRANCH):
            group(f"position-{position.name}", f"All {position.name}s", [a.person for a in held.filter(position=position)])
    return groups


# --- The phone calendar feed (A7) -----------------------------------------------------

def _hash(token):
    return hashlib.sha256(token.encode()).hexdigest()


class CalendarFeedView(APIView):
    """Make (or replace) my private calendar address. The secret is shown once."""
    permission_classes = [IsWorkspaceMember]

    def post(self, request):
        token = secrets.token_urlsafe(32)
        CalendarFeed.objects.update_or_create(person=request.user, defaults={"token_hash": _hash(token)})
        return Response({"token": token}, status=status.HTTP_201_CREATED)

    def delete(self, request):
        CalendarFeed.objects.filter(person=request.user).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


def _ics_text(value):
    return (value or "").replace("\\", "\\\\").replace(";", "\\;").replace(",", "\\,").replace("\r\n", "\\n") \
        .replace("\n", "\\n")


def _ics_time(moment):
    return moment.astimezone(dt_timezone.utc).strftime("%Y%m%dT%H%M%SZ")


def _fold(line):
    """iCalendar lines are at most 75 bytes; longer ones continue on the next line."""
    out, data = [], line.encode()
    while len(data) > 75:
        cut = 75
        while cut > 0 and (data[cut] & 0xC0) == 0x80:
            cut -= 1
        out.append(data[:cut].decode())
        data = b" " + data[cut:]
    out.append(data.decode())
    return "\r\n".join(out)


def calendar_feed(request, token):
    if len(token) > 64:
        raise Http404
    feed = CalendarFeed.objects.select_related("person").filter(token_hash=_hash(token)).first()
    if feed is None or not feed.person.is_active or not scopes.is_member(feed.person):
        raise Http404
    since = timezone.now() - timedelta(days=60)
    meetings = (Meeting.objects.filter(attendees__person=feed.person, starts_at__gte=since)
                .select_related("branch", "presbytery").distinct())
    stamp = _ics_time(timezone.now())
    lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//UPCZ//Shared workspace//EN", "CALSCALE:GREGORIAN",
             "X-WR-CALNAME:UPCZ meetings"]
    for m in meetings:
        location = ", ".join(filter(None, [m.venue, m.online_link]))
        lines += [
            "BEGIN:VEVENT", f"UID:upcz-meeting-{m.pk}@upcz", f"DTSTAMP:{stamp}",
            f"DTSTART:{_ics_time(m.starts_at)}", f"DTEND:{_ics_time(m.ends_at or m.starts_at + DEFAULT_LENGTH)}",
            f"SUMMARY:{_ics_text(m.title)}", f"DESCRIPTION:{_ics_text(place_title(m) + chr(10) + (m.agenda or ''))}",
            f"LOCATION:{_ics_text(location)}",
            f"STATUS:{'CANCELLED' if m.status == Meeting.CANCELLED else 'CONFIRMED'}", "END:VEVENT",
        ]
    lines.append("END:VCALENDAR")
    body = "\r\n".join(_fold(line) for line in lines) + "\r\n"
    response = HttpResponse(body, content_type="text/calendar; charset=utf-8")
    response["Cache-Control"] = "private, no-store"
    return response
