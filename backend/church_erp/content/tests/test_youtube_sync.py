"""YouTube → Sermon sync (AGENT_EXECUTION_PLAN.md, Task 0.4, option b)."""
from datetime import datetime, timezone as dt_timezone

import httpx
from django.core.management import call_command
from django.test import TestCase, override_settings
from django.utils import timezone

from church_erp.content.models import Sermon
from church_erp.content.tasks import sync_youtube_sermons
from church_erp.content.youtube_sync import sync_branch
from church_erp.core.tests.helpers import make_branch

CHANNEL = "UCabc123"


def video(video_id, title="A sermon", state="none", duration="PT45M10S",
          published="2026-10-04T08:00:00Z", description="desc"):
    """One item of a videos.list response, with every field the sync reads."""
    return {
        "id": video_id,
        "snippet": {
            "title": title,
            "description": description,
            "publishedAt": published,
            "liveBroadcastContent": state,
        },
        "contentDetails": {"duration": duration},
    }


class FakeYouTube:
    """Stands in for the YouTube Data API at the HTTP layer."""

    def __init__(self, videos=(), fail_with=None, empty_channel=False):
        self.videos = list(videos)
        self.fail_with = fail_with
        # YouTube only creates a channel's uploads list with its first video.
        self.empty_channel = empty_channel
        self.requests = []

    def handler(self, request):
        self.requests.append(request)
        if self.fail_with == "timeout":
            raise httpx.ReadTimeout("timed out", request=request)
        if self.fail_with:
            return httpx.Response(self.fail_with, json={"error": {"message": "boom"}})
        params = request.url.params
        if request.url.path.endswith("/playlistItems"):
            if self.empty_channel:
                return httpx.Response(404, json={"error": {"code": 404, "errors": [{"reason": "playlistNotFound"}]}})
            assert params["playlistId"] == "UU" + CHANNEL[2:]
            items = [{"contentDetails": {"videoId": v["id"]}} for v in self.videos]
            return httpx.Response(200, json={"items": items})
        if request.url.path.endswith("/videos"):
            wanted = params["id"].split(",")
            return httpx.Response(200, json={"items": [v for v in self.videos if v["id"] in wanted]})
        return httpx.Response(404)

    def client(self):
        return httpx.Client(transport=httpx.MockTransport(self.handler))


@override_settings(YOUTUBE_API_KEY="test-key")
class SyncBranchTests(TestCase):
    def setUp(self):
        self.branch = make_branch("alpha")
        self.branch.youtube_channel_id = CHANNEL
        self.branch.save()

    def sync(self, youtube):
        return sync_branch(self.branch, client=youtube.client())

    def test_imports_new_uploads_as_sermons(self):
        self.sync(FakeYouTube([video("v1", title="Grace", duration="PT1H2M3S")]))
        sermon = Sermon.objects.get(branch=self.branch, video_id="v1")
        self.assertEqual(sermon.title, "Grace")
        self.assertEqual(sermon.description, "desc")
        self.assertEqual(sermon.duration, "PT1H2M3S")
        self.assertEqual(sermon.preached_at, datetime(2026, 10, 4, 8, 0, tzinfo=dt_timezone.utc))
        self.assertFalse(sermon.is_live)

    def test_rerun_creates_no_duplicates_and_keeps_admin_edits(self):
        youtube = FakeYouTube([video("v1", title="Grace")])
        self.sync(youtube)
        Sermon.objects.filter(video_id="v1").update(title="Grace (edited)", series="Ephesians")
        self.sync(youtube)
        sermon = Sermon.objects.get(branch=self.branch, video_id="v1")
        self.assertEqual(Sermon.objects.filter(video_id="v1").count(), 1)
        self.assertEqual(sermon.title, "Grace (edited)")
        self.assertEqual(sermon.series, "Ephesians")

    def test_hidden_sermon_stays_hidden_and_is_not_imported_again(self):
        youtube = FakeYouTube([video("v1", title="Grace")])
        self.sync(youtube)
        Sermon.objects.filter(video_id="v1").update(is_hidden=True)
        self.sync(youtube)
        self.assertEqual(Sermon.objects.filter(video_id="v1").count(), 1)
        self.assertTrue(Sermon.objects.get(video_id="v1").is_hidden)

    def test_duration_is_refreshed_from_youtube(self):
        # A finished live stream reports P0D while live and its real length afterwards.
        self.sync(FakeYouTube([video("v1", state="live", duration="P0D")]))
        self.sync(FakeYouTube([video("v1", duration="PT1H30M")]))
        self.assertEqual(Sermon.objects.get(video_id="v1").duration, "PT1H30M")

    def test_marks_live_video_and_clears_ended_one(self):
        old = Sermon.objects.create(
            branch=self.branch, title="Last week", video_id="old", is_live=True,
            preached_at=timezone.now(),
        )
        self.sync(FakeYouTube([video("now", state="live", duration="P0D"), video("old")]))
        self.assertTrue(Sermon.objects.get(video_id="now").is_live)
        old.refresh_from_db()
        self.assertFalse(old.is_live)

    def test_scheduled_streams_are_not_imported_yet(self):
        self.sync(FakeYouTube([video("soon", state="upcoming")]))
        self.assertFalse(Sermon.objects.filter(video_id="soon").exists())

    def test_other_branches_are_untouched(self):
        other = make_branch("beta")
        other_live = Sermon.objects.create(
            branch=other, title="Theirs", video_id="theirs", is_live=True,
            preached_at=timezone.now(),
        )
        self.sync(FakeYouTube([video("v1")]))
        other_live.refresh_from_db()
        self.assertTrue(other_live.is_live)

    def test_api_error_changes_nothing_and_does_not_raise(self):
        live = Sermon.objects.create(
            branch=self.branch, title="On air", video_id="air", is_live=True,
            preached_at=timezone.now(),
        )
        for failure in (500, 403, "timeout"):
            with self.subTest(failure=failure):
                result = self.sync(FakeYouTube([video("v1")], fail_with=failure))
                self.assertTrue(result.error)
                self.assertFalse(Sermon.objects.filter(video_id="v1").exists())
                live.refresh_from_db()
                self.assertTrue(live.is_live)

    def test_a_channel_with_no_videos_yet_is_not_an_error(self):
        result = self.sync(FakeYouTube(empty_channel=True))
        self.assertEqual((result.created, result.live, result.error), (0, 0, ""))
        self.assertFalse(Sermon.objects.filter(branch=self.branch).exists())

    def test_other_not_found_answers_are_still_errors(self):
        # Only YouTube's "this playlist doesn't exist" means an empty channel.
        result = self.sync(FakeYouTube([video("v1")], fail_with=404))
        self.assertTrue(result.error)

    def test_branch_without_channel_makes_no_requests(self):
        self.branch.youtube_channel_id = ""
        youtube = FakeYouTube([video("v1")])
        self.sync(youtube)
        self.assertEqual(youtube.requests, [])

    def test_malformed_channel_id_is_reported_not_requested(self):
        self.branch.youtube_channel_id = "not-a-channel"
        youtube = FakeYouTube([video("v1")])
        result = self.sync(youtube)
        self.assertTrue(result.error)
        self.assertEqual(youtube.requests, [])

    @override_settings(YOUTUBE_API_KEY="")
    def test_missing_api_key_skips_sync(self):
        youtube = FakeYouTube([video("v1")])
        result = self.sync(youtube)
        self.assertTrue(result.error)
        self.assertEqual(youtube.requests, [])

    def test_the_key_never_appears_in_errors_or_logs(self):
        # The sync's answer goes back to cron-job.org, and its logs to Render.
        for failure in (500, 403, 404, "timeout"):
            with self.subTest(failure=failure):
                with self.assertLogs("church_erp.content.youtube_sync", level="WARNING") as logs:
                    result = self.sync(FakeYouTube([video("v1")], fail_with=failure))
                self.assertTrue(result.error)
                self.assertNotIn("test-key", result.error)
                self.assertNotIn("test-key", "\n".join(logs.output))
        self.assertEqual(self.sync(FakeYouTube(fail_with=403)).error, "YouTube answered 403")

    def test_api_key_is_sent(self):
        youtube = FakeYouTube([video("v1")])
        self.sync(youtube)
        self.assertTrue(all(r.url.params["key"] == "test-key" for r in youtube.requests))


@override_settings(YOUTUBE_API_KEY="test-key")
class SyncEntryPointTests(TestCase):
    def setUp(self):
        self.with_channel = make_branch("alpha")
        self.with_channel.youtube_channel_id = CHANNEL
        self.with_channel.save()
        self.inactive = make_branch("gamma")
        self.inactive.youtube_channel_id = CHANNEL
        self.inactive.is_active = False
        self.inactive.save()
        self.no_channel = make_branch("beta")

    def patch_client(self, youtube):
        from unittest import mock

        return mock.patch(
            "church_erp.content.youtube_sync.httpx.Client",
            return_value=youtube.client(),
        )

    def test_task_syncs_active_branches_with_a_channel(self):
        youtube = FakeYouTube([video("v1")])
        with self.patch_client(youtube):
            sync_youtube_sermons()
        self.assertEqual(
            set(Sermon.objects.values_list("branch__slug", flat=True)), {"alpha"}
        )

    def test_command_syncs_one_branch(self):
        youtube = FakeYouTube([video("v1")])
        with self.patch_client(youtube):
            call_command("sync_youtube", "--branch", "alpha", verbosity=0)
        self.assertTrue(Sermon.objects.filter(branch=self.with_channel, video_id="v1").exists())
