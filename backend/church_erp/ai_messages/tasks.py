from celery import shared_task

from .generation import run_daily


@shared_task
def generate_daily_messages():
    """Read waiting sermons and write tomorrow's daily message drafts. Idempotent.
    Where no Celery worker runs (Render's free plan), POST /api/tasks/daily-messages/ instead."""
    return run_daily()
