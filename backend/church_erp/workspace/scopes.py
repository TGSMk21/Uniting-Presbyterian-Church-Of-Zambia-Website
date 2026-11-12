"""Who belongs to which part of the church, and what they may do there
(AGENT_EXECUTION_PLAN.md, Task 8.1). Every workspace address asks these questions
here, so the rules live in one place and are tested once (tests/test_scopes.py)."""
from .models import BRANCH, PRESBYTERY, SYNOD, Appointment

# Roles that reach the workspace. Content editors (website staff) only do if they hold a position.
MEMBER_ROLES = {"branch_admin", "elder", "super_admin"}
MINISTER_ROLE = "branch_admin"


def _signed_in(user):
    return bool(user and user.is_authenticated and user.is_active and user.is_staff)


def current_appointments(user):
    if not _signed_in(user) or user.is_superuser:
        return Appointment.objects.none()
    return Appointment.objects.current().filter(person=user).select_related("position", "branch", "presbytery")


def is_member(user):
    if not _signed_in(user):
        return False
    if user.is_superuser or user.role in MEMBER_ROLES:
        return True
    return current_appointments(user).exists()


def presbytery_of(user):
    branch = getattr(user, "branch", None)
    return branch.presbytery if branch is not None else None


def is_minister_of(user, branch):
    return (_signed_in(user) and not user.is_superuser and user.role == MINISTER_ROLE
            and branch is not None and user.branch_id == branch.pk)


def can_organise(user, level, *, branch=None, presbytery=None):
    """May `user` plan meetings at this level and place (decision D8.5)?"""
    if not _signed_in(user):
        return False
    if user.is_superuser:
        return True
    if level == BRANCH and is_minister_of(user, branch):
        return True
    offices = current_appointments(user).filter(position__can_organise=True, position__level=level)
    if level == BRANCH:
        return branch is not None and offices.filter(branch=branch).exists()
    if level == PRESBYTERY:
        return presbytery is not None and offices.filter(presbytery=presbytery).exists()
    return level == SYNOD and offices.exists()


def organising_places(user):
    """Everywhere `user` may plan meetings, for the dashboard's choices."""
    from church_erp.core.models import Branch, Presbytery
    if not _signed_in(user):
        return {"branches": [], "presbyteries": [], "synod": False}
    if user.is_superuser:
        return {"branches": list(Branch.objects.filter(is_active=True)), "presbyteries": list(Presbytery.objects.all()),
                "synod": True}
    offices = list(current_appointments(user).filter(position__can_organise=True))
    branches = {a.branch for a in offices if a.branch is not None}
    if user.role == MINISTER_ROLE and user.branch is not None:
        branches.add(user.branch)
    return {
        "branches": sorted(branches, key=lambda b: b.name),
        "presbyteries": sorted({a.presbytery for a in offices if a.presbytery is not None}, key=lambda p: p.name),
        "synod": any(a.position.level == SYNOD for a in offices),
    }


def can_appoint(user, position, *, branch=None, presbytery=None):
    """Decision D8.4: a minister appoints their branch's office bearers; the superuser appoints anyone."""
    if not _signed_in(user):
        return False
    if user.is_superuser:
        return True
    return position.level == BRANCH and is_minister_of(user, branch)
