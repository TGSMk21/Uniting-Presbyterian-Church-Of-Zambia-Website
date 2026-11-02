from celery import shared_task

from church_erp.core.models import Branch

from .youtube_sync import sync_branch


@shared_task
def sync_youtube_sermons():
    """Sync every active branch that has a YouTube channel. Idempotent."""
    branches = Branch.objects.filter(is_active=True).exclude(youtube_channel_id="")
    return {
        branch.slug: sync_branch(branch).__dict__
        for branch in branches
    }
