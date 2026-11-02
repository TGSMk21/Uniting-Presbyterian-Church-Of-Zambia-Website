"""Import each branch's YouTube uploads as Sermons and keep `is_live` current.

Quota: each sync makes two 1-unit calls (playlistItems + videos), so a
5-minute schedule costs ~576 units/day per branch, well under YouTube's
10,000-unit default. search.list (100 units) is deliberately not used.
"""
import logging
from dataclasses import dataclass

import httpx
from django.conf import settings
from django.db import transaction
from django.utils.dateparse import parse_datetime

from .models import Sermon

logger = logging.getLogger(__name__)

API_BASE = "https://www.googleapis.com/youtube/v3"
TIMEOUT_SECONDS = 20  # background job; the API was seen taking 10s+ per call
RECENT_UPLOADS = 50  # playlistItems max page size


@dataclass
class SyncResult:
    created: int = 0
    live: int = 0
    error: str = ""


def fetch_recent_videos(client, channel_id, api_key):
    """Public videos among the channel's latest uploads, newest first."""
    uploads_playlist = "UU" + channel_id[2:]
    playlist = client.get(f"{API_BASE}/playlistItems", params={
        "part": "contentDetails",
        "playlistId": uploads_playlist,
        "maxResults": RECENT_UPLOADS,
        "key": api_key,
    })
    playlist.raise_for_status()
    video_ids = [item["contentDetails"]["videoId"] for item in playlist.json().get("items", [])]
    if not video_ids:
        return []
    # videos.list omits private/deleted uploads and carries the live state.
    details = client.get(f"{API_BASE}/videos", params={
        "part": "snippet,contentDetails",
        "id": ",".join(video_ids),
        "key": api_key,
    })
    details.raise_for_status()
    return details.json().get("items", [])


def sync_branch(branch, client=None):
    """Sync one branch. Never raises for API problems: they are logged and
    returned in `SyncResult.error`, leaving existing sermons unchanged."""
    channel_id = branch.youtube_channel_id
    if not channel_id:
        return SyncResult()
    if not channel_id.startswith("UC"):
        logger.warning("Branch %s has an invalid YouTube channel ID: %r", branch.slug, channel_id)
        return SyncResult(error=f"invalid channel ID {channel_id!r}")
    api_key = settings.YOUTUBE_API_KEY
    if not api_key:
        logger.warning("YOUTUBE_API_KEY is not set; skipping YouTube sync")
        return SyncResult(error="YOUTUBE_API_KEY is not set")

    owns_client = client is None
    client = client or httpx.Client(timeout=TIMEOUT_SECONDS)
    try:
        videos = fetch_recent_videos(client, channel_id, api_key)
    except (httpx.HTTPError, KeyError, ValueError) as exc:
        logger.warning("YouTube sync failed for branch %s: %s", branch.slug, exc)
        return SyncResult(error=str(exc) or exc.__class__.__name__)
    finally:
        if owns_client:
            client.close()

    result = SyncResult()
    live_ids = []
    with transaction.atomic():
        for video in videos:
            snippet = video["snippet"]
            state = snippet.get("liveBroadcastContent", "none")
            if state == "upcoming":
                continue  # imported once it goes live
            if state == "live":
                live_ids.append(video["id"])
            duration = video.get("contentDetails", {}).get("duration", "")
            sermon, created = Sermon.objects.get_or_create(
                branch=branch,
                video_id=video["id"],
                defaults={
                    "title": snippet["title"][:300],
                    "description": snippet.get("description", ""),
                    "preached_at": parse_datetime(snippet["publishedAt"]),
                    "duration": duration,
                },
            )
            if created:
                result.created += 1
            elif sermon.duration != duration:
                # Duration is YouTube's to own; titles etc. may be edited by staff.
                Sermon.objects.filter(pk=sermon.pk).update(duration=duration)

        # For branches with a channel, YouTube is the source of truth for is_live.
        Sermon.objects.filter(branch=branch, is_live=True).exclude(
            video_id__in=live_ids
        ).update(is_live=False)
        result.live = Sermon.objects.filter(branch=branch, video_id__in=live_ids).update(is_live=True)
    return result
