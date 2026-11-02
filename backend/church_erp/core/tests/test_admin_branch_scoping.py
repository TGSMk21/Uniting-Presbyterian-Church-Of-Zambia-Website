"""Branch scoping in the Django admin (AGENT_EXECUTION_PLAN.md, Task 0.2)."""
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone

from church_erp.accounts.models import User
from church_erp.content.models import Sermon
from church_erp.finance.models import GivingRecord

from .helpers import CONTENT_APPS, make_branch, make_branch_content, make_staff

APP_LABELS = {
    "minister": "core",
    "sermon": "content",
    "project": "content",
    "activity": "content",
    "page": "content",
    "mediaasset": "media_library",
    "dailymessage": "ai_messages",
    "givingrecord": "finance",
}
CONTENT_MODELS = [m for m in APP_LABELS if m != "givingrecord"]


def admin_url(model, action, *args):
    return reverse(f"admin:{APP_LABELS.get(model, 'core')}_{model}_{action}", args=args)


class BranchScopedAdminTestCase(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.branch_a = make_branch("alpha")
        cls.branch_b = make_branch("beta")
        cls.recorder = User.objects.create_user("recorder", password="pw")
        cls.content_a = make_branch_content(cls.branch_a, cls.recorder)
        cls.content_b = make_branch_content(cls.branch_b, cls.recorder)
        cls.admin_a = make_staff("admin_a", cls.branch_a, "branch_admin")

    def changelist_pks(self, user, model):
        self.client.force_login(user)
        response = self.client.get(admin_url(model, "changelist"))
        self.assertEqual(response.status_code, 200)
        return set(response.context["cl"].queryset.values_list("pk", flat=True))


class ChangelistScopingTests(BranchScopedAdminTestCase):
    def test_branch_admin_sees_only_own_branch_records(self):
        for model in CONTENT_MODELS:
            with self.subTest(model=model):
                self.assertEqual(
                    self.changelist_pks(self.admin_a, model),
                    {self.content_a[model].pk},
                )

    def test_branch_admin_sees_only_own_branch_in_branch_list(self):
        self.assertEqual(self.changelist_pks(self.admin_a, "branch"), {self.branch_a.pk})

    def test_superuser_sees_every_branch(self):
        superuser = User.objects.create_superuser("root", password="pw")
        for model in CONTENT_MODELS:
            with self.subTest(model=model):
                self.assertEqual(
                    self.changelist_pks(superuser, model),
                    {self.content_a[model].pk, self.content_b[model].pk},
                )

    def test_staff_user_without_branch_sees_nothing(self):
        orphan = make_staff("orphan", None, "branch_admin")
        for model in CONTENT_MODELS:
            with self.subTest(model=model):
                self.assertEqual(self.changelist_pks(orphan, model), set())

    def test_branch_admin_cannot_open_other_branch_record(self):
        self.client.force_login(self.admin_a)
        url = admin_url("sermon", "change", self.content_b["sermon"].pk)
        response = self.client.get(url)
        # The admin redirects to its index when an object is outside the queryset.
        self.assertRedirects(response, reverse("admin:index"))


class BranchAssignmentTests(BranchScopedAdminTestCase):
    def sermon_post_data(self, branch, title):
        now = timezone.localtime()
        return {
            "branch": branch.pk,
            "minister": "",
            "title": title,
            "series": "",
            "description": "",
            "video_id": "",
            "transcript": "",
            "reference_verse": "",
            "preached_at_0": now.strftime("%Y-%m-%d"),
            "preached_at_1": now.strftime("%H:%M:%S"),
        }

    def test_add_form_offers_only_own_branch(self):
        self.client.force_login(self.admin_a)
        response = self.client.get(admin_url("sermon", "add"))
        form = response.context["adminform"].form
        self.assertEqual(list(form.fields["branch"].queryset), [self.branch_a])

    def test_add_form_offers_only_own_branch_ministers(self):
        self.client.force_login(self.admin_a)
        for model in ("sermon", "dailymessage"):
            with self.subTest(model=model):
                response = self.client.get(admin_url(model, "add"))
                form = response.context["adminform"].form
                self.assertEqual(
                    list(form.fields["minister"].queryset),
                    [self.content_a["minister"]],
                )

    def test_daily_message_form_offers_only_own_branch_sermons(self):
        self.client.force_login(self.admin_a)
        response = self.client.get(admin_url("dailymessage", "add"))
        form = response.context["adminform"].form
        self.assertEqual(
            list(form.fields["source_sermons"].queryset), [self.content_a["sermon"]]
        )

    def test_cannot_create_record_for_other_branch(self):
        self.client.force_login(self.admin_a)
        self.client.post(
            admin_url("sermon", "add"), self.sermon_post_data(self.branch_b, "Sneaky")
        )
        self.assertFalse(Sermon.objects.filter(title="Sneaky", branch=self.branch_b).exists())

    def test_cannot_move_record_to_other_branch(self):
        sermon = self.content_a["sermon"]
        self.client.force_login(self.admin_a)
        self.client.post(
            admin_url("sermon", "change", sermon.pk),
            self.sermon_post_data(self.branch_b, sermon.title),
        )
        sermon.refresh_from_db()
        self.assertEqual(sermon.branch, self.branch_a)

    def test_save_model_forces_own_branch_even_if_form_is_bypassed(self):
        # Second line of defence behind the limited form choices.
        from django.contrib.admin.sites import site
        from django.test import RequestFactory

        request = RequestFactory().post("/")
        request.user = self.admin_a
        sermon = Sermon(branch=self.branch_b, title="Bypass", preached_at=timezone.now())
        site._registry[Sermon].save_model(request, sermon, form=None, change=False)
        self.assertEqual(Sermon.objects.get(title="Bypass").branch, self.branch_a)

    def test_can_create_record_for_own_branch(self):
        self.client.force_login(self.admin_a)
        response = self.client.post(
            admin_url("sermon", "add"), self.sermon_post_data(self.branch_a, "Mine")
        )
        self.assertRedirects(response, admin_url("sermon", "changelist"))
        self.assertTrue(Sermon.objects.filter(title="Mine", branch=self.branch_a).exists())

    def test_uploaded_by_is_set_to_current_user(self):
        self.client.force_login(self.admin_a)
        from django.core.files.uploadedfile import SimpleUploadedFile

        self.client.post(
            admin_url("mediaasset", "add"),
            {
                "branch": self.branch_a.pk,
                "file": SimpleUploadedFile("notes.txt", b"hello"),
                "file_type": "document",
                "title": "Notes",
                "description": "",
            },
        )
        from church_erp.media_library.models import MediaAsset

        asset = MediaAsset.objects.get(title="Notes")
        self.assertEqual(asset.uploaded_by, self.admin_a)


class BranchAdminPermissionTests(BranchScopedAdminTestCase):
    def test_branch_admin_cannot_add_branches(self):
        self.client.force_login(self.admin_a)
        self.assertEqual(self.client.get(admin_url("branch", "add")).status_code, 403)

    def test_branch_admin_cannot_delete_own_branch(self):
        self.client.force_login(self.admin_a)
        url = admin_url("branch", "delete", self.branch_a.pk)
        self.assertEqual(self.client.get(url).status_code, 403)


class FinanceAdminTests(BranchScopedAdminTestCase):
    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        every_app = CONTENT_APPS + ("finance",)
        cls.editor_a = make_staff("editor_a", cls.branch_a, "content_editor", every_app)
        cls.branch_admin_a = make_staff("badmin_a", cls.branch_a, "branch_admin", every_app)
        cls.finance_a = make_staff("finance_a", cls.branch_a, "finance_admin", ("finance",))

    def test_non_finance_roles_do_not_see_finance_module(self):
        # These users hold every finance model permission; the role alone must exclude them.
        for user in (self.editor_a, self.branch_admin_a):
            with self.subTest(role=user.role):
                self.client.force_login(user)
                index = self.client.get(reverse("admin:index"))
                app_labels = {app["app_label"] for app in index.context["app_list"]}
                self.assertNotIn("finance", app_labels)
                changelist = self.client.get(admin_url("givingrecord", "changelist"))
                self.assertEqual(changelist.status_code, 403)

    def test_finance_admin_sees_only_own_branch_giving(self):
        self.assertEqual(
            self.changelist_pks(self.finance_a, "givingrecord"),
            {self.content_a["givingrecord"].pk},
        )

    def test_finance_admin_cannot_delete_giving_records(self):
        self.client.force_login(self.finance_a)
        url = admin_url("givingrecord", "delete", self.content_a["givingrecord"].pk)
        self.assertEqual(self.client.get(url).status_code, 403)

    def test_recorded_by_is_set_to_current_user(self):
        self.client.force_login(self.finance_a)
        self.client.post(
            admin_url("givingrecord", "add"),
            {
                "branch": self.branch_a.pk,
                "member_name": "",
                "member_phone": "",
                "amount": "25.00",
                "currency": "ZMW",
                "giving_type": "offering",
                "payment_method": "cash",
                "reference_number": "alpha-ref-2",
                "notes": "",
                "status": "confirmed",
            },
        )
        record = GivingRecord.objects.get(reference_number="alpha-ref-2")
        self.assertEqual(record.recorded_by, self.finance_a)
        self.assertEqual(record.branch, self.branch_a)


class UserAdminTests(BranchScopedAdminTestCase):
    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        cls.user_admin_a = make_staff(
            "uadmin_a", cls.branch_a, "branch_admin", CONTENT_APPS + ("accounts", "auth")
        )
        cls.member_a = User.objects.create_user("member_a", branch=cls.branch_a)
        cls.member_b = User.objects.create_user("member_b", branch=cls.branch_b)
        cls.branchless = User.objects.create_user("branchless")

    def user_changelist_usernames(self, user):
        self.client.force_login(user)
        response = self.client.get(reverse("admin:accounts_user_changelist"))
        return set(response.context["cl"].queryset.values_list("username", flat=True))

    def test_branch_admin_sees_only_own_branch_users(self):
        usernames = self.user_changelist_usernames(self.user_admin_a)
        self.assertIn("member_a", usernames)
        self.assertNotIn("member_b", usernames)
        self.assertNotIn("branchless", usernames)

    def test_branch_admin_cannot_manage_more_privileged_users(self):
        # Otherwise a branch admin could reset their password and log in as them.
        finance_a = make_staff("finance_a", self.branch_a, "finance_admin", ("finance",))
        national = User.objects.create_user("national", branch=self.branch_a, role="super_admin")
        root = User.objects.create_superuser("root", password="pw", branch=self.branch_a)
        usernames = self.user_changelist_usernames(self.user_admin_a)
        for privileged in (finance_a, national, root):
            with self.subTest(user=privileged.username):
                self.assertNotIn(privileged.username, usernames)
                # Django's UserAdmin names this URL "auth_…" even for custom user models.
                url = reverse("admin:auth_user_password_change", args=[privileged.pk])
                self.assertNotEqual(self.client.get(url).status_code, 200)

    def test_staff_without_branch_sees_no_users(self):
        orphan = make_staff("orphan", None, "branch_admin", ("accounts",))
        self.assertEqual(self.user_changelist_usernames(orphan), set())

    def test_branch_admin_cannot_edit_privilege_fields(self):
        self.client.force_login(self.user_admin_a)
        response = self.client.get(
            reverse("admin:accounts_user_change", args=[self.member_a.pk])
        )
        fields = response.context["adminform"].form.fields
        for name in ("is_superuser", "is_staff", "groups", "user_permissions", "branch"):
            with self.subTest(field=name):
                self.assertNotIn(name, fields)

    def test_branch_admin_cannot_grant_national_or_finance_roles(self):
        self.client.force_login(self.user_admin_a)
        response = self.client.get(
            reverse("admin:accounts_user_change", args=[self.member_a.pk])
        )
        roles = {value for value, _ in response.context["adminform"].form.fields["role"].choices}
        self.assertEqual(roles, {"branch_admin", "content_editor"})

    def test_branch_admin_cannot_make_user_superuser_by_post(self):
        self.client.force_login(self.user_admin_a)
        now = timezone.localtime()
        self.client.post(
            reverse("admin:accounts_user_change", args=[self.member_a.pk]),
            {
                "username": "member_a",
                "first_name": "",
                "last_name": "",
                "email": "",
                "is_active": "on",
                "is_staff": "on",
                "is_superuser": "on",
                "date_joined_0": now.strftime("%Y-%m-%d"),
                "date_joined_1": now.strftime("%H:%M:%S"),
                "role": "content_editor",
                "branch": self.branch_b.pk,
            },
        )
        self.member_a.refresh_from_db()
        self.assertFalse(self.member_a.is_superuser)
        self.assertFalse(self.member_a.is_staff)
        self.assertEqual(self.member_a.branch, self.branch_a)

    def test_users_added_by_branch_admin_join_their_branch(self):
        self.client.force_login(self.user_admin_a)
        self.client.post(
            reverse("admin:accounts_user_add"),
            {
                "username": "newcomer",
                "password1": "a-Long-unique-pw-91",
                "password2": "a-Long-unique-pw-91",
                "usable_password": "true",
            },
        )
        self.assertEqual(User.objects.get(username="newcomer").branch, self.branch_a)
