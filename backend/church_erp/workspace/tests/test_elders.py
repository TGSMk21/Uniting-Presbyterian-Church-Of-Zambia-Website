"""Elders' accounts (AGENT_EXECUTION_PLAN.md, Task 8.1, A12): a minister adds or approves
elders for their branch; elders reach the workspace and never the website's content."""
from django.core.cache import cache
from django.urls import reverse
from rest_framework.test import APITestCase

from church_erp.accounts.models import AccessRequest, User

from .helpers import build_synod


class ElderAccountTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.addCleanup(cache.clear)
        build_synod(self)
        self.client.force_authenticate(self.minister)

    def test_a_minister_adds_an_elder_to_their_branch(self):
        response = self.client.post(reverse("staff-people-list"), {
            "username": "newelder", "first_name": "New", "last_name": "Elder", "role": "elder",
        }, format="json")
        self.assertEqual(response.status_code, 201, response.data)
        person = User.objects.get(username="newelder")
        self.assertEqual((person.role, person.branch), ("elder", self.a1))

    def test_a_minister_still_adds_content_editors_by_default_and_never_other_roles(self):
        self.client.post(reverse("staff-people-list"), {"username": "plain"}, format="json")
        self.assertEqual(User.objects.get(username="plain").role, "content_editor")
        self.client.post(reverse("staff-people-list"), {"username": "sneaky", "role": "branch_admin"}, format="json")
        self.assertNotEqual(User.objects.get(username="sneaky").role, "branch_admin")

    def test_a_minister_manages_their_elders_and_can_switch_them_with_content_editors(self):
        response = self.client.patch(reverse("staff-people-detail", args=[self.elder.pk]), {"role": "content_editor"}, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        self.elder.refresh_from_db()
        self.assertEqual(self.elder.role, "content_editor")
        # Not another branch's elders.
        self.assertEqual(self.client.patch(reverse("staff-people-detail", args=[self.elder_a2.pk]), {"first_name": "X"},
                                           format="json").status_code, 404)

    def test_a_minister_approves_a_request_as_an_elder(self):
        request = AccessRequest.objects.create(full_name="Grace Phiri", email="g@example.org", phone="0977000000",
                                               branch=self.a1, kind="staff")
        response = self.client.post(reverse("staff-requests-approve", args=[request.pk]),
                                    {"username": "gphiri", "role": "elder"}, format="json")
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(User.objects.get(username="gphiri").role, "elder")

    def test_elders_reach_no_website_content_or_pages(self):
        self.client.force_authenticate(self.elder)
        for url in (reverse("staff-sermons-list", args=["a1"]), reverse("staff-announcements-list", args=["a1"]),
                    reverse("page-content-page", args=["a1", "home"]), reverse("staff-people-list")):
            with self.subTest(url=url):
                self.assertEqual(self.client.get(url).status_code, 403)
