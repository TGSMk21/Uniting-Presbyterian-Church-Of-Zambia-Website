"""Notifications (AGENT_EXECUTION_PLAN.md, Task 8.2): each person reads only their own."""
from django.core.cache import cache
from django.urls import reverse
from rest_framework.test import APITestCase

from church_erp.workspace.models import Notification
from church_erp.workspace.notify import notify

from .helpers import build_synod


class NotifyTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.addCleanup(cache.clear)
        build_synod(self)

    def test_notify_reaches_each_person_once_but_not_the_one_who_acted(self):
        notify([self.elder, self.elder, self.minister, self.elder_a2], "meeting_invited", "Added to Session meeting",
               "/dashboard/meetings/1", actor=self.minister)
        self.assertEqual(sorted(Notification.objects.values_list("person__username", flat=True)), ["elder", "elder_a2"])

    def test_links_only_ever_point_inside_the_dashboard(self):
        for bad in ("https://evil.example", "//evil.example", "javascript:alert(1)", "/elsewhere"):
            with self.subTest(bad=bad):
                notify([self.elder], "meeting_invited", "x", bad)
        self.assertEqual(set(Notification.objects.values_list("link", flat=True)), {""})

    def test_people_who_are_suspended_get_nothing(self):
        self.elder.is_active = False
        self.elder.save()
        notify([self.elder], "meeting_invited", "x", "/dashboard/meetings/1")
        self.assertFalse(Notification.objects.exists())


class NotificationApiTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.addCleanup(cache.clear)
        build_synod(self)
        notify([self.elder], "meeting_invited", "Added to Session meeting", "/dashboard/meetings/1")
        notify([self.elder], "document_shared", "Budget shared with you", "/dashboard/documents/2")
        notify([self.elder_a2], "meeting_invited", "Someone else's", "/dashboard/meetings/3")
        self.client.force_authenticate(self.elder)

    def test_a_person_sees_only_theirs_newest_first_with_the_unread_count(self):
        data = self.client.get(reverse("workspace-notifications-list")).data
        self.assertEqual(data["unread"], 2)
        self.assertEqual([n["text"] for n in data["results"]], ["Budget shared with you", "Added to Session meeting"])
        self.assertEqual(set(data["results"][0]), {"id", "kind", "text", "link", "created_at", "read"})

    def test_every_page_asks_only_for_the_count(self):
        data = self.client.get(reverse("workspace-notifications-list") + "?count=1").data
        self.assertEqual(data, {"unread": 2})

    def test_opening_one_marks_it_read_and_all_can_be_marked_at_once(self):
        first = Notification.objects.filter(person=self.elder).last()
        self.assertEqual(self.client.post(reverse("workspace-notifications-read", args=[first.pk])).status_code, 200)
        self.assertEqual(self.client.get(reverse("workspace-notifications-list")).data["unread"], 1)
        self.client.post(reverse("workspace-notifications-read-all"))
        self.assertEqual(self.client.get(reverse("workspace-notifications-list")).data["unread"], 0)
        self.assertTrue(Notification.objects.filter(person=self.elder_a2, read_at__isnull=True).exists())

    def test_nobody_reads_or_marks_someone_elses(self):
        theirs = Notification.objects.get(person=self.elder_a2)
        self.assertEqual(self.client.post(reverse("workspace-notifications-read", args=[theirs.pk])).status_code, 404)
        theirs.refresh_from_db()
        self.assertIsNone(theirs.read_at)

    def test_website_staff_and_signed_out_people_are_refused(self):
        self.client.force_authenticate(self.editor)
        self.assertEqual(self.client.get(reverse("workspace-notifications-list")).status_code, 403)
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(reverse("workspace-notifications-list")).status_code, 401)
