"""Token-protected trigger for the YouTube sync (Render's free plan has no cron jobs)."""
from unittest import mock

from django.test import TestCase, override_settings
from django.urls import reverse

URL = reverse("sync-youtube")
TASK = "church_erp.api.views.sync_youtube_sermons"


@override_settings(SYNC_TOKEN="s3cret-token")
class SyncEndpointTests(TestCase):
    def test_correct_token_runs_the_sync_and_reports_it(self):
        with mock.patch(TASK, return_value={"alpha": {"created": 2, "live": 0, "error": ""}}) as task:
            response = self.client.post(URL, HTTP_X_SYNC_TOKEN="s3cret-token")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"alpha": {"created": 2, "live": 0, "error": ""}})
        task.assert_called_once_with()

    def test_wrong_or_missing_token_is_forbidden(self):
        for headers in ({"HTTP_X_SYNC_TOKEN": "guess"}, {}):
            with self.subTest(headers=headers), mock.patch(TASK) as task:
                response = self.client.post(URL, **headers)
                self.assertEqual(response.status_code, 403)
                task.assert_not_called()

    def test_only_post_is_allowed(self):
        with mock.patch(TASK) as task:
            response = self.client.get(URL, HTTP_X_SYNC_TOKEN="s3cret-token")
        self.assertEqual(response.status_code, 405)
        task.assert_not_called()

    @override_settings(SYNC_TOKEN="")
    def test_endpoint_is_disabled_without_a_configured_token(self):
        with mock.patch(TASK) as task:
            response = self.client.post(URL, HTTP_X_SYNC_TOKEN="")
        self.assertEqual(response.status_code, 404)
        task.assert_not_called()
