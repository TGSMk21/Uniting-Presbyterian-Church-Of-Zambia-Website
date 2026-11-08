"""Editable page content (AGENT_EXECUTION_PLAN.md, Task 5.2)."""
import json
from pathlib import Path

from django.core.cache import cache
from django.core.exceptions import ValidationError
from django.test import SimpleTestCase
from django.urls import reverse
from rest_framework.test import APITestCase

from church_erp.accounts.models import User
from church_erp.content.models import PageContent
from church_erp.content.page_content import SCHEMA, field_specs
from church_erp.core.models import Branch
from church_erp.core.tests.helpers import make_branch
from church_erp.core.validators import validate_not_reserved

WEBSITE_SCHEMA = Path(__file__).resolve().parents[4] / "presbyterian-web" / "Utilities" / "pageSchema.json"


def staff(username, branch=None, role="content_editor", **extra):
    return User.objects.create_user(username, password="pw", is_staff=True, branch=branch, role=role, **extra)


class SchemaTests(SimpleTestCase):
    def test_backend_and_website_use_the_same_list_of_fields(self):
        # They deploy separately, so each keeps a copy. This stops them drifting apart.
        self.assertEqual(SCHEMA, json.loads(WEBSITE_SCHEMA.read_text(encoding="utf-8")))

    def test_every_default_fits_its_own_limit(self):
        for scope, pages in SCHEMA.items():
            for page in pages:
                for spec in field_specs(scope, page).values():
                    if spec["type"] == "image":
                        continue
                    with self.subTest(scope=scope, page=page, key=spec["key"]):
                        self.assertLessEqual(len(spec["default"]), spec["max"])

    def test_fields_stored_on_the_branch_fit_its_columns(self):
        for spec in field_specs("branch", "home").values():
            if spec.get("store") == "branch" and spec["type"] != "image":
                column = Branch._meta.get_field(spec["key"])
                if column.max_length:
                    with self.subTest(key=spec["key"]):
                        self.assertLessEqual(spec["max"], column.max_length)

    def test_national_is_not_available_as_a_branch_address(self):
        with self.assertRaises(ValidationError):
            validate_not_reserved("national")


class PageContentTestCase(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.alpha = make_branch("alpha")
        cls.beta = make_branch("beta")
        cls.editor = staff("editor", cls.alpha)
        cls.manager = staff("manager", cls.alpha, "branch_admin")
        cls.other = staff("other", cls.beta)
        cls.treasurer = staff("treasurer", cls.alpha, "finance_admin")
        cls.national = staff("national", None, "super_admin")
        cls.root = User.objects.create_superuser("root", password="pw")

    def setUp(self):
        cache.clear()
        self.addCleanup(cache.clear)

    def url(self, scope, page):
        return reverse("page-content-page", args=[scope, page])

    def save(self, user, scope, page, fields):
        self.client.force_authenticate(user)
        return self.client.put(self.url(scope, page), {"fields": fields}, format="json")


class PublicReadTests(PageContentTestCase):
    def test_anyone_can_read_what_has_been_changed(self):
        PageContent.objects.create(branch=None, page="home", fields={"hero_text": "Hello"})
        response = self.client.get(reverse("page-content", args=["national"]))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["pages"], {"home": {"hero_text": "Hello"}})

    def test_each_scope_only_sees_its_own(self):
        PageContent.objects.create(branch=None, page="home", fields={"hero_text": "National"})
        PageContent.objects.create(branch=self.alpha, page="home", fields={"verse_label": "Alpha"})
        PageContent.objects.create(branch=self.beta, page="home", fields={"verse_label": "Beta"})
        response = self.client.get(reverse("page-content", args=["alpha"]))
        self.assertEqual(response.data["pages"], {"home": {"verse_label": "Alpha"}})

    def test_nothing_changed_is_an_empty_answer(self):
        self.assertEqual(self.client.get(reverse("page-content", args=["alpha"])).data["pages"], {})

    def test_unknown_branch_is_not_found(self):
        self.assertEqual(self.client.get(reverse("page-content", args=["nowhere"])).status_code, 404)

    def test_visitors_cannot_see_who_edited(self):
        PageContent.objects.create(branch=None, page="home", fields={"hero_text": "Hi"}, updated_by=self.root)
        self.assertNotIn("root", str(self.client.get(reverse("page-content", args=["national"])).data))


class WhoCanEditTests(PageContentTestCase):
    FIELDS = {"banner_label": "Changed"}

    def code(self, user, scope):
        return self.save(user, scope, "about" if scope != "national" else "contact", self.FIELDS).status_code

    def test_visitors_cannot_edit(self):
        response = self.client.put(self.url("alpha", "about"), {"fields": self.FIELDS}, format="json")
        self.assertEqual(response.status_code, 401)

    def test_staff_edit_their_own_branch(self):
        self.assertEqual(self.code(self.editor, "alpha"), 200)
        self.assertEqual(self.code(self.manager, "alpha"), 200)

    def test_staff_cannot_edit_another_branch(self):
        self.assertEqual(self.code(self.editor, "beta"), 403)
        self.assertFalse(PageContent.objects.filter(branch=self.beta).exists())

    def test_branch_staff_cannot_edit_national_pages(self):
        self.assertEqual(self.code(self.manager, "national"), 403)
        self.assertFalse(PageContent.objects.exists())

    def test_national_admins_edit_national_pages_only(self):
        self.assertEqual(self.code(self.national, "national"), 200)
        self.assertEqual(self.code(self.national, "alpha"), 403)

    def test_superusers_edit_everything(self):
        self.assertEqual(self.code(self.root, "national"), 200)
        self.assertEqual(self.code(self.root, "beta"), 200)

    def test_finance_staff_cannot_edit_pages(self):
        self.assertEqual(self.code(self.treasurer, "alpha"), 403)

    def test_someone_who_lost_staff_status_cannot_edit(self):
        User.objects.filter(pk=self.editor.pk).update(is_staff=False)
        self.editor.refresh_from_db()
        self.assertEqual(self.code(self.editor, "alpha"), 403)

    def test_the_edit_form_data_follows_the_same_rules(self):
        self.client.force_authenticate(self.other)
        self.assertEqual(self.client.get(self.url("alpha", "about")).status_code, 403)
        self.client.force_authenticate(self.editor)
        self.assertEqual(self.client.get(self.url("alpha", "about")).status_code, 200)


class SavingTests(PageContentTestCase):
    def stored(self, branch=None, page="about"):
        row = PageContent.objects.filter(branch=branch, page=page).first()
        return row.fields if row else {}

    def test_saving_keeps_only_what_differs_from_the_original(self):
        original = field_specs("branch", "about")["banner_label"]["default"]
        response = self.save(self.editor, "alpha", "about", {"banner_label": original, "banner_title": "New *title*"})
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(self.stored(self.alpha), {"banner_title": "New *title*"})

    def test_clearing_a_field_goes_back_to_the_original(self):
        self.save(self.editor, "alpha", "about", {"banner_title": "New", "banner_text": "Also new"})
        self.save(self.editor, "alpha", "about", {"banner_title": "", "banner_text": "Also new"})
        self.assertEqual(self.stored(self.alpha), {"banner_text": "Also new"})

    def test_going_back_to_all_originals_leaves_nothing_stored(self):
        self.save(self.editor, "alpha", "about", {"banner_title": "New"})
        self.save(self.editor, "alpha", "about", {})
        self.assertFalse(PageContent.objects.exists())

    def test_it_records_who_edited(self):
        self.save(self.editor, "alpha", "about", {"banner_title": "New"})
        self.assertEqual(PageContent.objects.get().updated_by, self.editor)
        self.client.force_authenticate(self.manager)
        response = self.client.get(self.url("alpha", "about"))
        self.assertEqual(response.data["updated_by"], "editor")
        self.assertTrue(response.data["updated_at"])

    def test_surrounding_spaces_are_removed_and_windows_line_breaks_tidied(self):
        self.save(self.editor, "alpha", "about", {"banner_title": "  Hi  ", "vision_list": "One\r\nTwo"})
        self.assertEqual(self.stored(self.alpha), {"banner_title": "Hi", "vision_list": "One\nTwo"})

    def test_saving_one_page_leaves_other_pages_alone(self):
        self.save(self.editor, "alpha", "about", {"banner_title": "About"})
        self.save(self.editor, "alpha", "sermons", {"banner_title": "Sermons"})
        self.assertEqual(self.stored(self.alpha, "about"), {"banner_title": "About"})

    def test_saving_a_branch_leaves_other_branches_alone(self):
        self.save(self.editor, "alpha", "about", {"banner_title": "Alpha"})
        self.save(self.other, "beta", "about", {"banner_title": "Beta"})
        self.assertEqual(self.stored(self.alpha), {"banner_title": "Alpha"})


class ValidationTests(PageContentTestCase):
    def errors(self, fields, scope="alpha", page="about", user=None):
        response = self.save(user or self.editor, scope, page, fields)
        self.assertEqual(response.status_code, 400, response.content)
        return response.data["fields"]

    def test_unknown_fields_are_refused(self):
        self.assertIn("is_admin", self.errors({"is_admin": "yes"}))
        self.assertFalse(PageContent.objects.exists())

    def test_too_long_is_refused(self):
        self.assertIn("banner_label", self.errors({"banner_label": "x" * 81}))

    def test_only_text_is_accepted(self):
        for bad in (5, ["a"], {"a": 1}, True, None):
            with self.subTest(bad=bad):
                self.assertIn("banner_label", self.errors({"banner_label": bad}))

    def test_fields_must_be_an_object(self):
        self.client.force_authenticate(self.editor)
        response = self.client.put(self.url("alpha", "about"), {"fields": "nope"}, format="json")
        self.assertEqual(response.status_code, 400)

    def test_email_must_look_like_an_email(self):
        self.assertIn("email", self.errors({"email": "not-an-email"}, "national", "contact", self.root))

    def test_phone_must_look_like_a_phone_number(self):
        for bad in ("javascript:alert(1)", "call me", "12"):
            with self.subTest(bad=bad):
                self.assertIn("phone", self.errors({"phone": bad}, "national", "contact", self.root))

    # Banner slide buttons (owner's request, 2026-11-08): a page on this site or a secure address.
    def test_slide_links_must_be_a_page_here_or_a_secure_address(self):
        for bad in ("javascript:alert(1)", "http://example.org", "//evil.example", "example.org", "/ spaces", "data:text/html,x"):
            with self.subTest(bad=bad):
                self.assertIn("slide2_link", self.errors({"slide2_link": bad}, "alpha", "home"))
                self.assertIn("slide2_link", self.errors({"slide2_link": bad}, "national", "home", self.root))
        for good in ("/alpha/projects-and-activities", "/find-a-branch#map", "https://www.youtube.com/@upcz", ""):
            with self.subTest(good=good):
                self.assertEqual(self.save(self.editor, "alpha", "home", {"slide2_link": good}).status_code, 200)

    def test_good_contact_details_are_accepted(self):
        response = self.save(self.root, "national", "contact", {"email": "office@upcz.org", "phone": "+260 (97) 123-4567"})
        self.assertEqual(response.status_code, 200, response.content)

    def test_one_bad_field_saves_nothing(self):
        self.errors({"banner_title": "Fine", "banner_label": "x" * 81})
        self.assertFalse(PageContent.objects.exists())

    def test_unknown_pages_and_scopes_are_not_found(self):
        self.client.force_authenticate(self.root)
        for scope, page in (("alpha", "nope"), ("nowhere", "about"), ("national", "about"), ("alpha", "contact")):
            with self.subTest(scope=scope, page=page):
                self.assertEqual(self.client.put(self.url(scope, page), {"fields": {}}, format="json").status_code, 404)


class BranchFieldTests(PageContentTestCase):
    """Tagline, welcome text and the year theme already live on the branch."""

    def test_they_are_saved_on_the_branch_not_in_page_content(self):
        response = self.save(self.editor, "alpha", "home", {
            "tagline": "New tagline", "welcome_text": "Welcome", "year_theme_title": "Hope", "verse_label": "Hi",
        })
        self.assertEqual(response.status_code, 200, response.content)
        self.alpha.refresh_from_db()
        self.assertEqual(self.alpha.tagline, "New tagline")
        self.assertEqual(self.alpha.welcome_text, "Welcome")
        self.assertEqual(self.alpha.year_theme_title, "Hope")
        self.assertEqual(PageContent.objects.get().fields, {"verse_label": "Hi"})

    def test_clearing_them_clears_the_branch(self):
        Branch.objects.filter(pk=self.alpha.pk).update(tagline="Old", year_theme_title="Old theme")
        self.save(self.editor, "alpha", "home", {})
        self.alpha.refresh_from_db()
        self.assertEqual(self.alpha.tagline, "")
        self.assertEqual(self.alpha.year_theme_title, "")

    def test_the_edit_form_shows_their_current_values(self):
        Branch.objects.filter(pk=self.alpha.pk).update(tagline="Current")
        PageContent.objects.create(branch=self.alpha, page="home", fields={"verse_label": "Hi"})
        self.client.force_authenticate(self.editor)
        fields = self.client.get(self.url("alpha", "home")).data["fields"]
        self.assertEqual(fields, {"verse_label": "Hi", "tagline": "Current"})

    def test_nothing_else_on_the_branch_can_be_changed_this_way(self):
        response = self.save(self.editor, "alpha", "home", {"slug": "stolen", "contact_email": "x@example.org"})
        self.assertEqual(response.status_code, 400)
        self.alpha.refresh_from_db()
        self.assertEqual(self.alpha.slug, "alpha")
