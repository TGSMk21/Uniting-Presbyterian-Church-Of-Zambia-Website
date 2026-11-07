"""Token-protected trigger for the daily message drafts (AGENT_EXECUTION_PLAN.md, Task 4.4).

Render's free plan has no Celery worker, so an outside scheduler (cron-job.org)
POSTs here, like the YouTube sync. Each call stays well inside the website
host's 60-second limit; the next call carries on where it stopped."""
from unittest import mock

from django.test import TestCase, override_settings
from django.urls import reverse

URL = reverse("generate-daily-messages")
RUN = "church_erp.api.views.run_daily"


@override_settings(SYNC_TOKEN="s3cret-token")
class DailyMessagesEndpointTests(TestCase):
    def test_correct_token_runs_it_with_a_time_limit_and_reports_it(self):
        report = {"day": "2026-11-09", "read": 1, "drafted": 1, "left": 0, "errors": []}
        with mock.patch(RUN, return_value=report) as run:
            response = self.client.post(URL, HTTP_X_SYNC_TOKEN="s3cret-token")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), report)
        run.assert_called_once_with(budget_seconds=25)

    def test_wrong_or_missing_token_is_forbidden(self):
        for headers in ({"HTTP_X_SYNC_TOKEN": "guess"}, {}):
            with self.subTest(headers=headers), mock.patch(RUN) as run:
                self.assertEqual(self.client.post(URL, **headers).status_code, 403)
                run.assert_not_called()

    def test_only_post_is_allowed(self):
        with mock.patch(RUN) as run:
            self.assertEqual(self.client.get(URL, HTTP_X_SYNC_TOKEN="s3cret-token").status_code, 405)
            run.assert_not_called()

    @override_settings(SYNC_TOKEN="")
    def test_disabled_without_a_configured_token(self):
        with mock.patch(RUN) as run:
            self.assertEqual(self.client.post(URL, HTTP_X_SYNC_TOKEN="").status_code, 404)
            run.assert_not_called()


class CeleryScheduleTests(TestCase):
    def test_the_task_runs_every_morning_in_zambia(self):
        from django.conf import settings
        entry = settings.CELERY_BEAT_SCHEDULE["generate-daily-messages"]
        self.assertEqual(entry["task"], "church_erp.ai_messages.tasks.generate_daily_messages")
        self.assertEqual(settings.CELERY_TIMEZONE, "Africa/Lusaka")
        self.assertEqual(entry["schedule"].hour, {3})
        self.assertEqual(entry["schedule"].minute, {17})

    def test_the_task_runs_the_job_without_a_time_limit(self):
        from church_erp.ai_messages.tasks import generate_daily_messages
        with mock.patch("church_erp.ai_messages.tasks.run_daily", return_value={"ai": "off"}) as run:
            self.assertEqual(generate_daily_messages(), {"ai": "off"})
        run.assert_called_once_with()
