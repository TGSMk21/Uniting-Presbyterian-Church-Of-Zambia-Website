"""Ministers' accounts belong to their branch (AGENT_EXECUTION_PLAN.md, Task 7.1).

A minister's profile can be linked to one login. Decision D1: that login is a
Branch Admin of the minister's own branch. Superusers are for the developer and
are never linked. Only superusers link and unlink, from the staff page."""
from django.core.cache import cache
from django.core.exceptions import ValidationError
from django.urls import reverse
from rest_framework.test import APITestCase

from church_erp.accounts.models import User
from church_erp.core.models import Minister, StaffChange
from church_erp.core.tests.helpers import make_branch

LIST = reverse("staff-people-list")


def detail(pk):
    return reverse("staff-people-detail", args=[pk])


def person(username, branch, role="branch_admin", **extra):
    return User.objects.create_user(username, password="pw", is_staff=True, branch=branch, role=role, **extra)


class MinisterAccountTestCase(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.alpha = make_branch("alpha")
        cls.beta = make_branch("beta")
        cls.boss = User.objects.create_superuser("boss", password="pw")
        cls.banda = Minister.objects.create(branch=cls.alpha, name="Banda")
        cls.phiri = Minister.objects.create(branch=cls.beta, name="Phiri")
        cls.account = person("banda", cls.alpha)

    def setUp(self):
        cache.clear()
        self.addCleanup(cache.clear)
        self.client.force_authenticate(self.boss)


class ModelRuleTests(MinisterAccountTestCase):
    def test_a_good_link_passes_its_checks(self):
        self.banda.account = self.account
        self.banda.full_clean()

    def test_the_account_must_be_a_branch_admin_of_the_same_branch_and_not_a_superuser(self):
        cases = {
            "other branch": person("other", self.beta),
            "editor": person("editor", self.alpha, role="content_editor"),
            # Same branch and role, so only being a superuser can refuse it.
            "superuser": User.objects.create_superuser("root", password="pw", branch=self.alpha, role="branch_admin"),
        }
        for label, account in cases.items():
            with self.subTest(label):
                self.banda.account = account
                with self.assertRaises(ValidationError):
                    self.banda.full_clean()

    def test_one_account_belongs_to_one_minister_only(self):
        self.banda.account = self.account
        self.banda.save()
        other = Minister.objects.create(branch=self.alpha, name="Mwale", account=None)
        other.account = self.account
        with self.assertRaises(ValidationError):
            other.full_clean()


class LinkingFromTheStaffPageTests(MinisterAccountTestCase):
    def test_superusers_link_and_unlink_and_it_is_recorded(self):
        response = self.client.patch(detail(self.account.pk), {"minister": self.banda.pk}, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["minister"], self.banda.pk)
        self.assertEqual(response.data["minister_name"], "Banda")
        self.banda.refresh_from_db()
        self.assertEqual(self.banda.account, self.account)
        self.assertEqual(StaffChange.objects.last().changes, ["minister"])

        response = self.client.patch(detail(self.account.pk), {"minister": None}, format="json")
        self.assertEqual(response.status_code, 200)
        self.banda.refresh_from_db()
        self.assertIsNone(self.banda.account)

    def test_a_new_ministers_account_can_be_made_already_linked(self):
        response = self.client.post(LIST, {
            "username": "rev_banda", "role": "branch_admin", "branch": "alpha", "minister": self.banda.pk,
        }, format="json")
        self.assertEqual(response.status_code, 201, response.data)
        self.banda.refresh_from_db()
        self.assertEqual(self.banda.account.username, "rev_banda")

    def test_wrong_links_are_refused(self):
        other_minister_account = person("phiri_acct", self.beta)
        self.phiri.account = other_minister_account
        self.phiri.save()
        mwale = Minister.objects.create(branch=self.alpha, name="Mwale")
        mwale.account = self.account
        mwale.save()
        editor = person("editor", self.alpha, role="content_editor")
        cases = [
            ("minister of another branch", self.account, self.phiri.pk),
            ("account not a branch admin", editor, self.banda.pk),
            ("minister already linked to someone else", person("second_admin", self.alpha), mwale.pk),
        ]
        free = Minister.objects.create(branch=self.beta, name="Zulu")
        cases.append(("minister already has another account", other_minister_account, free.pk))
        for label, account, minister in cases:
            with self.subTest(label):
                response = self.client.patch(detail(account.pk), {"minister": minister}, format="json")
                if label == "minister already has another account":
                    # Moving a login to another minister of its branch is allowed: it's unlinked from the first.
                    self.assertEqual(response.status_code, 200, response.data)
                    continue
                self.assertEqual(response.status_code, 400, response.data)
                self.assertIn("minister", response.data)

    def test_a_linked_account_cant_change_branch_or_role_without_unlinking(self):
        self.banda.account = self.account
        self.banda.save()
        for change in ({"branch": "beta"}, {"role": "content_editor"}):
            with self.subTest(change):
                response = self.client.patch(detail(self.account.pk), change, format="json")
                self.assertEqual(response.status_code, 400)
                self.assertIn("minister", response.data)
        # Both at once, unlinking in the same change, is fine.
        response = self.client.patch(detail(self.account.pk), {"branch": "beta", "minister": None}, format="json")
        self.assertEqual(response.status_code, 200, response.data)

    def test_branch_admins_cant_link_or_unlink(self):
        self.client.force_authenticate(person("admin_a", self.alpha))
        editor = person("editor", self.alpha, role="content_editor")
        response = self.client.patch(detail(editor.pk), {"minister": self.banda.pk}, format="json")
        self.banda.refresh_from_db()
        self.assertIsNone(self.banda.account)
        self.assertNotEqual(response.data.get("minister"), self.banda.pk)


class MinisterPageTests(MinisterAccountTestCase):
    def test_the_ministers_page_says_which_account_they_sign_in_with(self):
        self.banda.account = self.account
        self.banda.save()
        self.client.force_authenticate(self.account)
        data = self.client.get(reverse("staff-ministers-detail", args=["alpha", self.banda.pk])).data
        self.assertEqual(data["account_username"], "banda")
        # It can't be changed from the minister's page.
        self.client.patch(reverse("staff-ministers-detail", args=["alpha", self.banda.pk]), {"account": None}, format="json")
        self.banda.refresh_from_db()
        self.assertEqual(self.banda.account, self.account)


class DjangoAdminTests(MinisterAccountTestCase):
    def test_only_superusers_can_link_an_account_in_the_django_admin(self):
        from church_erp.core.admin import MinisterAdmin
        from django.contrib.admin.sites import site
        from django.test import RequestFactory

        admin = MinisterAdmin(Minister, site)
        request = RequestFactory().get("/")
        request.user = person("admin_a", self.alpha)
        self.assertIn("account", admin.get_readonly_fields(request, self.banda))
        request.user = self.boss
        self.assertNotIn("account", admin.get_readonly_fields(request, self.banda))
