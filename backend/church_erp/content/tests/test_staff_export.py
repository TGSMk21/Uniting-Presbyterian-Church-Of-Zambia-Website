"""CSV export from the dashboard (AGENT_EXECUTION_PLAN.md, Task 5.3).

Every section exports at /api/staff/<branch>/<section>/export/, limited to the
rows that person can manage there."""
import csv
import io
from datetime import date, time

from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase

from church_erp.accounts.models import User
from church_erp.ai_messages.models import DailyMessage
from church_erp.content.models import Activity, Project, Sermon
from church_erp.core.models import Minister, ServiceTime
from church_erp.core.tests.helpers import make_branch
from church_erp.media_library.models import MediaAsset, MediaTag

SECTIONS = ("sermons", "projects", "activities", "ministers", "services", "messages", "media")


def export_url(scope, section):
    return reverse(f"staff-{section}-export", args=[scope])


class ExportTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.alpha = make_branch("alpha")
        cls.beta = make_branch("beta")
        cls.editor = User.objects.create_user(
            "editor", password="pw", is_staff=True, branch=cls.alpha, role="content_editor",
        )
        for branch, word in ((cls.alpha, "Ours"), (cls.beta, "Theirs")):
            Sermon.objects.create(branch=branch, title=f"{word} sermon", video_id=f"{word}vid", preached_at=timezone.now())
            Project.objects.create(branch=branch, title=f"{word} project", description="d", start_date=date(2026, 1, 1))
            Activity.objects.create(
                branch=branch, title=f"{word} activity", date=date(2026, 12, 1), start_time=time(9),
                end_time=time(10), location="Hall", details="d",
            )
            minister = Minister.objects.create(branch=branch, name=f"{word} minister")
            ServiceTime.objects.create(branch=branch, day="Sunday", title=f"{word} service", start_time=time(9), end_time=time(10))
            DailyMessage.objects.create(minister=minister, title=f"{word} message", message="m", date=date(2026, 11, 1))
            MediaAsset.objects.create(branch=branch, file="media_library/a.pdf", file_type="document", title=f"{word} file")

    def setUp(self):
        self.client.force_authenticate(self.editor)

    def rows(self, response):
        text = response.content.decode("utf-8-sig")
        return list(csv.reader(io.StringIO(text)))

    def test_every_section_exports_only_this_branchs_rows(self):
        for section in SECTIONS:
            response = self.client.get(export_url("alpha", section))
            self.assertEqual(response.status_code, 200, section)
            text = response.content.decode("utf-8-sig")
            self.assertIn("Ours", text, section)
            self.assertNotIn("Theirs", text, section)
            self.assertEqual(len(self.rows(response)), 2, section)

    def test_other_branch_and_signed_out_are_refused(self):
        for section in SECTIONS:
            self.assertEqual(self.client.get(export_url("beta", section)).status_code, 403, section)
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(export_url("alpha", "sermons")).status_code, 401)

    def test_is_a_csv_file_excel_reads_properly(self):
        response = self.client.get(export_url("alpha", "projects"))
        self.assertEqual(response["Content-Type"], "text/csv; charset=utf-8")
        self.assertRegex(response["Content-Disposition"], r'^attachment; filename="alpha-projects-\d{4}-\d{2}-\d{2}\.csv"$')
        # Excel needs the marker to read letters such as ŵ correctly.
        self.assertTrue(response.content.startswith(b"\xef\xbb\xbf"))
        self.assertEqual(response["Cache-Control"], "no-store")

    def test_letters_beyond_english_survive(self):
        Project.objects.filter(branch=self.alpha).update(description="Chiŵa and Bemba: café")
        header, row = self.rows(self.client.get(export_url("alpha", "projects")))
        self.assertEqual(row[header.index("Description")], "Chiŵa and Bemba: café")

    def test_headings_are_readable_and_values_plain(self):
        Sermon.objects.filter(branch=self.alpha).update(is_hidden=True, reference_verse="John 3:16")
        header, row = self.rows(self.client.get(export_url("alpha", "sermons")))
        self.assertIn("Title", header)
        self.assertIn("Reference verse", header)
        self.assertEqual(row[header.index("Is hidden")], "Yes")
        self.assertEqual(row[header.index("Reference verse")], "John 3:16")

    def test_spreadsheet_formulas_are_neutralised(self):
        Project.objects.filter(branch=self.alpha).update(title='=HYPERLINK("http://x","click")', description="+1")
        header, row = self.rows(self.client.get(export_url("alpha", "projects")))
        self.assertEqual(row[header.index("Title")], "'=HYPERLINK(\"http://x\",\"click\")")
        self.assertEqual(row[header.index("Description")], "'+1")
        for cell in ("-2", "@SUM(A1)", "\tx", "\rx"):
            Project.objects.filter(branch=self.alpha).update(title=cell)
            header, row = self.rows(self.client.get(export_url("alpha", "projects")))
            self.assertEqual(row[header.index("Title")], "'" + cell, repr(cell))

    def test_media_export_has_no_links_and_follows_the_filters(self):
        asset = MediaAsset.objects.get(title="Ours file")
        asset.tags.add(MediaTag.objects.create(name="Council"))
        MediaAsset.objects.create(branch=self.alpha, file="media_library/b.webp", file_type="image", title="Ours photo")
        response = self.client.get(export_url("alpha", "media"), {"type": "document"})
        header, *rows = self.rows(response)
        self.assertEqual([r[header.index("Title")] for r in rows], ["Ours file"])
        self.assertEqual(rows[0][header.index("Tags")], "Council")
        # Signed links give access to private files, so they stay out of exports.
        self.assertNotIn("Url", header)
        self.assertNotIn("media_library/", response.content.decode("utf-8-sig"))

    def test_messages_show_the_minister_by_name(self):
        header, row = self.rows(self.client.get(export_url("alpha", "messages")))
        self.assertEqual(row[header.index("Minister name")], "Ours minister")
