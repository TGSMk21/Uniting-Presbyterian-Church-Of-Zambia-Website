"""Builders for the workspace tests: a small synod with two presbyteries."""
from church_erp.accounts.models import User
from church_erp.core.models import Branch, Minister, Presbytery
from church_erp.workspace.models import Appointment, Position


def build_synod(test):
    """Two presbyteries (north, south); north has branches a1 and a2, south has b1.
    People: a minister and an elder at a1, an elder at a2 and at b1, a content
    editor at a1 (not in the workspace), and a superuser."""
    test.north = Presbytery.objects.create(name="North", slug="north", order=1)
    test.south = Presbytery.objects.create(name="South", slug="south", order=2)
    test.a1 = Branch.objects.create(name="A1", slug="a1", presbytery=test.north)
    test.a2 = Branch.objects.create(name="A2", slug="a2", presbytery=test.north)
    test.b1 = Branch.objects.create(name="B1", slug="b1", presbytery=test.south)

    def person(username, branch, role, **extra):
        return User.objects.create_user(username, password="pw", is_staff=True, branch=branch, role=role,
                                        first_name=username.title(), **extra)

    test.minister = person("minister", test.a1, "branch_admin")
    Minister.objects.create(branch=test.a1, name="Rev A1", account=test.minister)
    test.elder = person("elder", test.a1, "elder")
    test.elder_a2 = person("elder_a2", test.a2, "elder")
    test.elder_b1 = person("elder_b1", test.b1, "elder")
    test.editor = person("editor", test.a1, "content_editor")
    test.root = User.objects.create_superuser("root", password="pw")

    test.session_clerk = Position.objects.get(level="branch", name="Session Clerk")
    test.treasurer = Position.objects.get(level="branch", name="Treasurer")
    test.presbytery_clerk = Position.objects.get(level="presbytery", name="Clerk")
    test.synod_clerk = Position.objects.get(level="synod", name="Clerk")


def appoint(person, position, branch=None, presbytery=None):
    return Appointment.objects.create(person=person, position=position, branch=branch, presbytery=presbytery)
