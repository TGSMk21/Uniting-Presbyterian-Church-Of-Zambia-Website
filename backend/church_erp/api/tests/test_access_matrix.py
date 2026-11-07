"""Who can reach what, for every staff address at once (AGENT_EXECUTION_PLAN.md, Task 5.5).

Each section has its own tests; this file tries every staff address with
every kind of person who must be refused, so a gap in one place can't hide.
It also fails when a staff address is added without being listed here."""
from datetime import date, time

from django.core.cache import cache
from django.urls import get_resolver, reverse
from django.utils import timezone
from rest_framework.test import APITestCase

from church_erp.accounts.models import AccessRequest, User
from church_erp.ai_messages.models import DailyMessage, SermonDocument
from church_erp.content.models import Activity, Project, Sermon
from church_erp.core.models import Minister, ServiceTime
from church_erp.core.tests.helpers import make_branch
from church_erp.media_library.models import MediaAsset

# Every branch section, and the extra addresses it has besides list and detail.
SECTIONS = {
    "sermons": [], "projects": [], "activities": [], "services": [], "messages": [],
    "ministers": ["photo"],
    "media": ["tags"],
    "writings": ["upload"],
}
POST_EXTRAS = {"upload"}
PEOPLE_ACTIONS = ["suspend", "restore", "reset-password", "reset-two-factor"]
# Access requests (Task 7.2): superusers, and Branch Admins for their own branch's staff.
REQUEST_ACTIONS = ["approve", "turn-down"]
# Branch admins manage staff; only superusers manage branches and read the history.
SUPERUSER_ONLY = ["staff-branches", "staff-changes"]


def staff_url_names():
    names = set()

    def walk(patterns):
        for pattern in patterns:
            if hasattr(pattern, "url_patterns"):
                walk(pattern.url_patterns)
            elif pattern.name and pattern.name.startswith("staff"):
                names.add(pattern.name)

    walk(get_resolver().url_patterns)
    return names


class AccessMatrixTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.alpha = make_branch("alpha")
        cls.beta = make_branch("beta")

        def user(name, branch, role):
            return User.objects.create_user(name, password="pw", is_staff=True, branch=branch, role=role)

        cls.editor_a = user("editor_a", cls.alpha, "content_editor")
        cls.admin_a = user("admin_a", cls.alpha, "branch_admin")
        # A minister's own account (Task 7.1) is a Branch Admin linked to their profile;
        # being linked must not reach any further than that.
        Minister.objects.create(branch=cls.alpha, name="Alpha minister", account=cls.admin_a)
        cls.finance_a = user("finance_a", cls.alpha, "finance_admin")
        cls.editor_b = user("editor_b", cls.beta, "content_editor")
        cls.admin_b = user("admin_b", cls.beta, "branch_admin")

        cls.beta_request = AccessRequest.objects.create(
            full_name="Beta Staff", email="bs@example.org", phone="0971234567", branch=cls.beta, kind="staff",
        )

        # One row of every kind in beta, to be reached from alpha.
        minister = Minister.objects.create(branch=cls.beta, name="Beta minister")
        cls.rows = {
            "sermons": Sermon.objects.create(branch=cls.beta, title="B", video_id="b1", preached_at=timezone.now()),
            "projects": Project.objects.create(branch=cls.beta, title="B", description="d", start_date=date(2026, 1, 1)),
            "activities": Activity.objects.create(
                branch=cls.beta, title="B", date=date(2026, 12, 1), start_time=time(9), end_time=time(10),
                location="Hall", details="d",
            ),
            "ministers": minister,
            "services": ServiceTime.objects.create(branch=cls.beta, day="Sunday", title="B", start_time=time(9), end_time=time(10)),
            "messages": DailyMessage.objects.create(minister=minister, title="B", message="m", date=date(2026, 11, 1)),
            "media": MediaAsset.objects.create(branch=cls.beta, file="media_library/b.pdf", file_type="document", title="B"),
            "writings": SermonDocument.objects.create(minister=minister, title="B", text="Words"),
        }

    def setUp(self):
        cache.clear()
        self.addCleanup(cache.clear)

    def branch_addresses(self, scope, pk):
        """(method, url) for every address of every branch section, on `scope`."""
        for section, extras in SECTIONS.items():
            yield "get", reverse(f"staff-{section}-list", args=[scope])
            yield "post", reverse(f"staff-{section}-list", args=[scope])
            yield "get", reverse(f"staff-{section}-export", args=[scope])
            for extra in extras:
                if extra == "photo":
                    yield "post", reverse("staff-ministers-photo", args=[scope, pk(section)])
                    yield "delete", reverse("staff-ministers-photo", args=[scope, pk(section)])
                else:
                    method = "post" if extra in POST_EXTRAS else "get"
                    yield method, reverse(f"staff-{section}-{extra}", args=[scope])
            for method in ("get", "patch", "put", "delete"):
                yield method, reverse(f"staff-{section}-detail", args=[scope, pk(section)])
        yield "get", reverse("staff-branch-details", args=[scope])
        yield "patch", reverse("staff-branch-details", args=[scope])
        for page in ("home", "about"):
            yield "get", reverse("page-content-page", args=[scope, page])
            yield "put", reverse("page-content-page", args=[scope, page])
        yield "post", reverse("page-image", args=[scope, "home", "hero_image"])
        yield "delete", reverse("page-image", args=[scope, "home", "hero_image"])

    def admin_addresses(self, person_pk):
        yield "get", reverse("staff-people-list")
        yield "post", reverse("staff-people-list")
        yield "get", reverse("staff-people-detail", args=[person_pk])
        yield "patch", reverse("staff-people-detail", args=[person_pk])
        for name in PEOPLE_ACTIONS:
            yield "post", reverse(f"staff-people-{name}", args=[person_pk])

    def superuser_addresses(self):
        yield "get", reverse("staff-branches-list")
        yield "post", reverse("staff-branches-list")
        yield "get", reverse("staff-branches-detail", args=["beta"])
        yield "patch", reverse("staff-branches-detail", args=["beta"])
        yield "get", reverse("staff-changes-list")

    def refused(self, user, addresses, allowed_statuses):
        self.client.force_authenticate(user)
        wrong = []
        for method, url in addresses:
            status = getattr(self.client, method)(url, {}, format="json").status_code
            if status not in allowed_statuses:
                wrong.append(f"{method.upper()} {url} -> {status}")
        return wrong

    def test_every_staff_address_is_listed_here(self):
        listed = {f"staff-{section}-{kind}" for section, extras in SECTIONS.items() for kind in ["list", "detail", "export", *extras]}
        listed |= {"staff-branch-details", "staff-people-list", "staff-people-detail"}
        listed |= {f"staff-people-{name}" for name in PEOPLE_ACTIONS}
        listed |= {"staff-requests-list", "staff-requests-detail"} | {f"staff-requests-{name}" for name in REQUEST_ACTIONS}
        listed |= {f"{name}-{kind}" for name in SUPERUSER_ONLY for kind in ("list", "detail")}
        self.assertEqual(staff_url_names() - listed, set(), "Add new staff addresses to this file.")

    def test_signed_out_people_are_refused_everywhere(self):
        addresses = [
            *self.branch_addresses("alpha", lambda s: self.rows[s].pk),
            *self.admin_addresses(self.editor_a.pk),
            *self.superuser_addresses(),
        ]
        self.assertEqual(self.refused(None, addresses, {401}), [])

    def test_another_branchs_addresses_are_refused(self):
        for user in (self.editor_a, self.admin_a):
            with self.subTest(user=user.username):
                addresses = self.branch_addresses("beta", lambda s: self.rows[s].pk)
                self.assertEqual(self.refused(user, addresses, {403}), [])

    def test_another_branchs_rows_cant_be_reached_through_your_own_branch(self):
        def own_scope_row_addresses():
            for method, url in self.branch_addresses("alpha", lambda s: self.rows[s].pk):
                if any(url.endswith(f"/{row.pk}/") or url.endswith(f"/{row.pk}/photo/") for row in self.rows.values()):
                    yield method, url

        for user in (self.editor_a, self.admin_a):
            with self.subTest(user=user.username):
                addresses = list(own_scope_row_addresses())
                self.assertEqual(len(addresses), len(SECTIONS) * 4 + 2)
                # Sermons can't be deleted by anyone (405), which refuses before any lookup.
                self.assertEqual(self.refused(user, addresses, {404, 405}), [])

    def test_finance_roles_reach_no_content(self):
        addresses = [*self.branch_addresses("alpha", lambda s: self.rows[s].pk), *self.admin_addresses(self.editor_a.pk)]
        self.assertEqual(self.refused(self.finance_a, addresses, {403}), [])

    def test_content_editors_reach_no_admin_sections(self):
        addresses = [*self.admin_addresses(self.editor_b.pk), *self.superuser_addresses()]
        self.assertEqual(self.refused(self.editor_a, addresses, {403}), [])

    def test_branch_admins_reach_no_superuser_sections_or_other_branches_staff(self):
        self.assertEqual(self.refused(self.admin_a, self.superuser_addresses(), {403}), [])
        # Other branches' people are invisible, so they're "not found".
        addresses = [(m, u) for m, u in self.admin_addresses(self.editor_b.pk) if "/staff-people/" in u and str(self.editor_b.pk) in u]
        # Resetting two-step login is refused to branch admins before any lookup (403).
        self.assertEqual(self.refused(self.admin_a, addresses, {403, 404}), [])


    # Who can review access requests (Task 7.2).
    def request_addresses(self):
        pk = self.beta_request.pk
        yield "get", reverse("staff-requests-list")
        yield "get", reverse("staff-requests-detail", args=[pk])
        for name in REQUEST_ACTIONS:
            yield "post", reverse(f"staff-requests-{name}", args=[pk])

    def test_requests_refuse_signed_out_people_editors_and_finance(self):
        self.assertEqual(self.refused(None, self.request_addresses(), {401}), [])
        for user in (self.editor_a, self.finance_a):
            with self.subTest(user=user.username):
                self.assertEqual(self.refused(user, self.request_addresses(), {403}), [])

    def test_another_branchs_requests_are_invisible_to_a_branchs_minister(self):
        addresses = [(m, u) for m, u in self.request_addresses() if u != reverse("staff-requests-list")]
        self.assertEqual(self.refused(self.admin_a, addresses, {404}), [])
        self.client.force_authenticate(self.admin_a)
        self.assertEqual(self.client.get(reverse("staff-requests-list")).data["results"], [])
