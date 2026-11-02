"""Nationwide upcoming activities for the national landing page (Task 1.2)."""
from datetime import date, time

from django.urls import reverse
from rest_framework.test import APITestCase

from church_erp.content.models import Activity
from church_erp.core.tests.helpers import make_branch


def make_activity(branch, title, day):
    return Activity.objects.create(
        branch=branch, title=title, date=day, start_time=time(9), end_time=time(10),
        details="d", location="Hall",
    )


class UpcomingActivitiesTests(APITestCase):
    def setUp(self):
        self.alpha = make_branch("alpha")
        self.beta = make_branch("beta")
        self.closed = make_branch("closed")
        self.closed.is_active = False
        self.closed.save()
        make_activity(self.alpha, "Past", date(2026, 10, 1))
        make_activity(self.beta, "Later", date(2026, 12, 6))
        make_activity(self.alpha, "Soon", date(2026, 11, 14))
        make_activity(self.closed, "Hidden", date(2026, 11, 20))

    def get(self, **params):
        return self.client.get(reverse("activity-list"), params).data["results"]

    def test_lists_activities_from_a_date_onwards_soonest_first(self):
        rows = self.get(date__gte="2026-11-02")
        self.assertEqual([r["title"] for r in rows], ["Soon", "Later"])

    def test_each_activity_names_its_branch(self):
        soon = self.get(date__gte="2026-11-02")[0]
        self.assertEqual(soon["branch_name"], "Alpha")
        self.assertEqual(soon["branch_slug"], "alpha")

    def test_inactive_branches_are_left_out_of_public_lists(self):
        titles = {r["title"] for r in self.get()}
        self.assertNotIn("Hidden", titles)

    def test_branch_filter_still_works(self):
        self.assertEqual({r["title"] for r in self.get(branch="beta")}, {"Later"})
