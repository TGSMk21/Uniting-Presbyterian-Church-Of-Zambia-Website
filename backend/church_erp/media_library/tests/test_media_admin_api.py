"""Media library admin and API (AGENT_EXECUTION_PLAN.md, Task 3.2)."""
from django.contrib.admin.helpers import ACTION_CHECKBOX_NAME
from django.core.management import call_command
from django.urls import reverse
from rest_framework.test import APITestCase

from church_erp.accounts.models import User
from church_erp.core.tests.helpers import make_branch
from church_erp.media_library.models import MediaAsset, MediaTag


class MediaLibraryTestCase(APITestCase):
    def setUp(self):
        call_command("setup_roles", verbosity=0)
        self.alpha = make_branch("alpha")
        self.beta = make_branch("beta")
        self.editor = User.objects.create_user(
            "ed", password="pw", is_staff=True, branch=self.alpha, role="content_editor"
        )
        self.photo = MediaAsset.objects.create(
            branch=self.alpha, file="media_library/easter.jpg", file_type="image", title="Easter"
        )
        self.minutes = MediaAsset.objects.create(
            branch=self.alpha, file="media_library/minutes.pdf", file_type="document", title="Minutes"
        )
        self.theirs = MediaAsset.objects.create(
            branch=self.beta, file="media_library/theirs.jpg", file_type="image", title="Theirs"
        )
        self.easter = MediaTag.objects.create(name="Easter")
        self.photo.tags.add(self.easter)


class MediaApiFilterTests(MediaLibraryTestCase):
    def ids(self, **params):
        self.client.force_authenticate(self.editor)
        response = self.client.get(reverse("mediaasset-list"), params)
        return {row["id"] for row in response.data["results"]}

    def test_filter_by_file_type(self):
        self.assertEqual(self.ids(file_type="image"), {self.photo.pk})

    def test_filter_by_tag(self):
        self.assertEqual(self.ids(tags=self.easter.pk), {self.photo.pk})


class MediaAdminTests(MediaLibraryTestCase):
    def changelist(self):
        self.client.force_login(self.editor)
        return self.client.get(reverse("admin:media_library_mediaasset_changelist"))

    def test_changelist_previews_images_only(self):
        html = self.changelist().content.decode()
        self.assertIn(f'src="{self.photo.file.url}"', html)
        self.assertNotIn(f'src="{self.minutes.file.url}"', html)

    def test_changelist_can_filter_by_tag(self):
        self.client.force_login(self.editor)
        response = self.client.get(
            reverse("admin:media_library_mediaasset_changelist"), {"tags__id__exact": self.easter.pk}
        )
        self.assertEqual(
            set(response.context["cl"].queryset.values_list("pk", flat=True)), {self.photo.pk}
        )

    def test_bulk_tagging_creates_the_tag_and_tags_the_selection(self):
        self.client.force_login(self.editor)
        self.client.post(
            reverse("admin:media_library_mediaasset_changelist"),
            {
                "action": "add_tag",
                "tag": "  Youth Day 2026 ",
                ACTION_CHECKBOX_NAME: [self.photo.pk, self.minutes.pk],
            },
        )
        tag = MediaTag.objects.get(name="Youth Day 2026")
        self.assertEqual(set(tag.mediaasset_set.values_list("pk", flat=True)), {self.photo.pk, self.minutes.pk})

    def test_bulk_tagging_cannot_reach_other_branches(self):
        self.client.force_login(self.editor)
        self.client.post(
            reverse("admin:media_library_mediaasset_changelist"),
            {"action": "add_tag", "tag": "Sneaky", ACTION_CHECKBOX_NAME: [self.theirs.pk]},
        )
        self.assertFalse(self.theirs.tags.filter(name="Sneaky").exists())

    def test_bulk_tagging_without_a_tag_name_changes_nothing(self):
        self.client.force_login(self.editor)
        self.client.post(
            reverse("admin:media_library_mediaasset_changelist"),
            {"action": "add_tag", "tag": "   ", ACTION_CHECKBOX_NAME: [self.photo.pk]},
        )
        self.assertEqual(MediaTag.objects.count(), 1)
