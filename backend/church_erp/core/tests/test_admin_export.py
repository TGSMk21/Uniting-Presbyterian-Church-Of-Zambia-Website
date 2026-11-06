"""CSV export from the admin, the church's exit plan (AGENT_EXECUTION_PLAN.md, Phase 6)."""
import csv
import io

from django import forms
from django.test import TestCase
from django.urls import reverse

from church_erp.accounts.models import User
from church_erp.content.models import Sermon
from church_erp.core.tests.helpers import make_branch, make_branch_content, make_staff
from church_erp.finance.models import GivingRecord

# Everything a church would need to take with it, keyed by (app, model).
EXPORTABLE = [
    ("core", "branch"),
    ("core", "minister"),
    ("content", "sermon"),
    ("content", "project"),
    ("content", "activity"),
    ("content", "page"),
    ("media_library", "mediaasset"),
    ("ai_messages", "dailymessage"),
    ("finance", "givingrecord"),
]


class ExportTestCase(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.alpha = make_branch("alpha")
        cls.beta = make_branch("beta")
        cls.superuser = User.objects.create_superuser("root", password="pw")
        cls.a = make_branch_content(cls.alpha, cls.superuser)
        cls.b = make_branch_content(cls.beta, cls.superuser)

    def export_url(self, app, model):
        return reverse(f"admin:{app}_{model}_export")

    def export(self, app, model):
        """Fill in the export form as a browser would, ticking every column."""
        url = self.export_url(app, model)
        page = self.client.get(url)
        self.assertEqual(page.status_code, 200)
        form = page.context["form"]
        data = {"format": "0"}
        for name, field in form.fields.items():
            if isinstance(field, forms.BooleanField):
                data[name] = "on"
            elif name == "resource":
                data[name] = form.initial.get("resource", field.initial) or "0"
        response = self.client.post(url, data)
        self.assertEqual(response.status_code, 200)
        self.assertIn("text/csv", response["Content-Type"], getattr(response, "context", None) and
                      response.context["form"].errors)
        return list(csv.DictReader(io.StringIO(response.content.decode("utf-8"))))


class SuperuserExportTests(ExportTestCase):
    def test_every_content_type_can_be_exported(self):
        self.client.force_login(self.superuser)
        for app, model in EXPORTABLE:
            with self.subTest(model=model):
                self.assertGreaterEqual(len(self.export(app, model)), 2)

    def test_the_list_page_has_an_export_button(self):
        self.client.force_login(self.superuser)
        response = self.client.get(reverse("admin:content_sermon_changelist"))
        self.assertContains(response, self.export_url("content", "sermon"))

    def test_the_csv_holds_the_real_data(self):
        self.client.force_login(self.superuser)
        titles = {row["title"] for row in self.export("content", "sermon")}
        self.assertEqual(titles, {"alpha sermon", "beta sermon"})

    def test_spreadsheet_formulas_in_content_are_neutralised(self):
        Sermon.objects.filter(pk=self.a["sermon"].pk).update(title='=HYPERLINK("http://evil.example")')
        self.client.force_login(self.superuser)
        titles = {row["title"] for row in self.export("content", "sermon")}
        self.assertFalse(any(title.startswith("=") for title in titles), titles)


class BranchStaffExportTests(ExportTestCase):
    def test_staff_export_only_their_own_branch(self):
        self.client.force_login(make_staff("editor", self.alpha, "branch_admin"))
        for app, model in EXPORTABLE:
            if model == "givingrecord":
                continue
            with self.subTest(model=model):
                rows = self.export(app, model)
                self.assertGreaterEqual(len(rows), 1)
                text = str(rows)
                self.assertNotIn("beta", text)

    def test_content_staff_cannot_export_giving_records(self):
        # Holding every model permission must not be enough: finance is role-gated.
        staff = make_staff("editor", self.alpha, "content_editor", apps=("finance",))
        self.client.force_login(staff)
        url = self.export_url("finance", "givingrecord")
        self.assertEqual(self.client.get(url).status_code, 403)
        self.assertEqual(self.client.post(url, {"format": "0"}).status_code, 403)

    def test_finance_staff_export_only_their_own_branch_giving(self):
        self.client.force_login(make_staff("treasurer", self.alpha, "finance_admin", apps=("finance",)))
        rows = self.export("finance", "givingrecord")
        self.assertEqual([row["reference_number"] for row in rows], ["alpha-ref-1"])
        self.assertTrue(GivingRecord.objects.filter(reference_number="beta-ref-1").exists())

    def test_staff_without_view_permission_cannot_export(self):
        self.client.force_login(make_staff("nobody", self.alpha, "content_editor", apps=()))
        self.assertEqual(self.client.get(self.export_url("content", "sermon")).status_code, 403)

    def test_visitors_cannot_export(self):
        response = self.client.get(self.export_url("content", "sermon"))
        self.assertEqual(response.status_code, 302)
        self.assertIn("login", response["Location"])
