"""The church's structure for the workspace (AGENT_EXECUTION_PLAN.md, Task 8.1):
where each person belongs, who holds which office, and finding people by name.
Only names and offices are shown here, never contact details."""
from django.db import transaction
from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import mixins, permissions, serializers, status, viewsets
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView

from church_erp.accounts.models import User
from church_erp.core.changes import record
from church_erp.core.models import Branch, Presbytery

from . import scopes
from .models import SYNOD, Appointment, Position, appointment_problem

PEOPLE_LIMIT = 30


class IsWorkspaceMember(permissions.BasePermission):
    message = "The shared workspace is for ministers, elders and office bearers."

    def has_permission(self, request, view):
        return scopes.is_member(request.user)


def person_name(person):
    return person.get_full_name() or person.username


def place(obj):
    return {"slug": obj.slug, "name": obj.name} if obj is not None else None


def person_brief(person):
    return {"id": person.pk, "name": person_name(person), "branch": place(person.branch)}


def appointment_row(appointment, *, with_person=True):
    row = {
        "id": appointment.pk,
        "title": appointment.title,
        "position": {"id": appointment.position_id, "name": appointment.position.name, "level": appointment.position.level},
        "branch": place(appointment.branch),
        "presbytery": place(appointment.presbytery),
        "started_on": appointment.started_on,
    }
    if with_person:
        row["person"] = person_brief(appointment.person)
    return row


def office_bearer(appointment):
    return {"id": appointment.pk, "title": appointment.position.name, "person": person_brief(appointment.person)}


class MeView(APIView):
    """Where the signed-in person belongs and what they may do. Answers everyone signed in,
    so the dashboard knows whether to offer the workspace at all."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        organise = scopes.organising_places(user)
        return Response({
            "member": scopes.is_member(user),
            "branch": place(user.branch) if not user.is_superuser else None,
            "presbytery": place(scopes.presbytery_of(user)) if not user.is_superuser else None,
            "appointments": [appointment_row(a, with_person=False) for a in scopes.current_appointments(user)],
            "organise": {
                "branches": [place(b) for b in organise["branches"]],
                "presbyteries": [place(p) for p in organise["presbyteries"]],
                "synod": organise["synod"],
            },
            "is_superuser": user.is_superuser,
        })


class StructureView(APIView):
    """Presbyteries, their branches and office bearers, and the synod's office bearers."""
    permission_classes = [IsWorkspaceMember]

    def get(self, request):
        current = list(Appointment.objects.current().select_related("person__branch", "position", "branch", "presbytery")
                       .order_by("position__order", "position__name"))
        presbyteries = Presbytery.objects.prefetch_related("branches")
        return Response({
            "synod": {"office_bearers": [office_bearer(a) for a in current if a.position.level == SYNOD]},
            "presbyteries": [{
                "id": p.pk, "slug": p.slug, "name": p.name,
                "branches": [place(b) for b in p.branches.all() if b.is_active],
                "office_bearers": [office_bearer(a) for a in current if a.presbytery_id == p.pk],
            } for p in presbyteries],
            "unplaced_branches": [place(b) for b in Branch.objects.filter(is_active=True, presbytery__isnull=True)],
            "positions": [{"id": p.pk, "name": p.name, "level": p.level, "can_organise": p.can_organise}
                          for p in Position.objects.filter(is_active=True)],
        })


class BranchOfficeView(APIView):
    """One branch's office bearers (for its minister's appointing screen and everyone's reading)."""
    permission_classes = [IsWorkspaceMember]

    def get(self, request, slug):
        branch = get_object_or_404(Branch, slug=slug, is_active=True)
        held = Appointment.objects.current().filter(branch=branch).select_related("person__branch", "position", "branch")
        return Response({
            "branch": place(branch),
            "presbytery": place(branch.presbytery),
            "office_bearers": [office_bearer(a) for a in held],
            "can_appoint": scopes.is_minister_of(request.user, branch) or request.user.is_superuser,
            "positions": [{"id": p.pk, "name": p.name} for p in Position.objects.filter(is_active=True, level="branch")],
        })


def members():
    member_roles = Q(role__in=scopes.MEMBER_ROLES) | Q(appointments__ended_on__isnull=True, appointments__isnull=False)
    return (User.objects.filter(is_active=True, is_staff=True, is_superuser=False).filter(member_roles)
            .select_related("branch__presbytery").distinct())


def search_people(params):
    people = members()
    query = (params.get("q") or "").strip()
    if query:
        for word in query.split()[:4]:
            people = people.filter(Q(first_name__icontains=word) | Q(last_name__icontains=word) | Q(username__icontains=word))
    if params.get("branch"):
        people = people.filter(branch__slug=params["branch"])
    if params.get("presbytery"):
        people = people.filter(branch__presbytery__slug=params["presbytery"])
    return people.order_by("first_name", "last_name", "username")


class PeopleView(APIView):
    """Find workspace members by name: names, branches and offices only."""
    permission_classes = [IsWorkspaceMember]

    def get(self, request):
        people = list(search_people(request.query_params)[:PEOPLE_LIMIT])
        offices = {}
        for a in Appointment.objects.current().filter(person__in=people).select_related("position", "branch", "presbytery"):
            offices.setdefault(a.person_id, []).append(a.title)
        return Response([{
            "id": p.pk, "name": person_name(p), "branch": place(p.branch),
            "presbytery": place(p.branch.presbytery if p.branch else None), "offices": offices.get(p.pk, []),
        } for p in people])


class AppointmentSerializer(serializers.Serializer):
    person = serializers.PrimaryKeyRelatedField(queryset=User.objects.filter(is_active=True, is_superuser=False))
    position = serializers.PrimaryKeyRelatedField(queryset=Position.objects.filter(is_active=True))
    branch = serializers.SlugRelatedField(slug_field="slug", queryset=Branch.objects.filter(is_active=True),
                                          required=False, allow_null=True)
    presbytery = serializers.SlugRelatedField(slug_field="slug", queryset=Presbytery.objects.all(),
                                              required=False, allow_null=True)


class AppointmentViewSet(mixins.CreateModelMixin, mixins.DestroyModelMixin, viewsets.GenericViewSet):
    """Appoint someone (decision D8.4), or end an appointment. Ending keeps it on record."""
    permission_classes = [IsWorkspaceMember]
    queryset = Appointment.objects.current().select_related("person__branch", "position", "branch", "presbytery")

    def create(self, request, *args, **kwargs):
        serializer = AppointmentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        values = serializer.validated_data
        person, position = values["person"], values["position"]
        branch, presbytery = values.get("branch"), values.get("presbytery")
        if not scopes.can_appoint(request.user, position, branch=branch, presbytery=presbytery):
            raise PermissionDenied("You can't appoint people to this position.")
        problem = appointment_problem(person, position, branch, presbytery)
        if problem:
            raise serializers.ValidationError({"person": [problem]})
        with transaction.atomic():
            if position.single_holder:
                # Handover: the previous holder steps down today (A9 moves their open work too).
                Appointment.objects.current().filter(position=position, branch=branch, presbytery=presbytery) \
                    .update(ended_on=timezone.localdate())
            appointment = Appointment.objects.create(person=person, position=position, branch=branch,
                                                     presbytery=presbytery, appointed_by=request.user)
            if position.single_holder:
                from .deliverables import hand_over
                hand_over(position, branch, presbytery, person, request.user)
        record(request.user, "appointments", "added", branch=branch, target=appointment.title, target_id=appointment.pk)
        return Response(appointment_row(appointment), status=status.HTTP_201_CREATED)

    def destroy(self, request, *args, **kwargs):
        appointment = self.get_object()
        if not scopes.can_appoint(request.user, appointment.position, branch=appointment.branch,
                                  presbytery=appointment.presbytery):
            raise PermissionDenied("You can't change this position.")
        appointment.ended_on = timezone.localdate()
        appointment.save(update_fields=["ended_on"])
        record(request.user, "appointments", "ended", branch=appointment.branch, target=appointment.title,
               target_id=appointment.pk)
        return Response(status=status.HTTP_204_NO_CONTENT)
