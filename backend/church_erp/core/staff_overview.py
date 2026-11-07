"""What needs attention, for the dashboard's Overview (AGENT_EXECUTION_PLAN.md, Task 7.3).

Only for what the person may see: their own branch, or every branch for
superusers. Every count is worked out in the database in one query, so the
page stays quick as branches are added."""
from datetime import timedelta

from django.conf import settings
from django.db.models import Count, Exists, IntegerField, OuterRef, Subquery
from django.db.models.functions import Coalesce
from django.utils import timezone
from rest_framework.response import Response
from rest_framework.views import APIView

from church_erp.accounts.access_requests import visible_requests
from church_erp.accounts.auth_views import IsStaff
from church_erp.accounts.staff_people import is_branch_admin
from church_erp.ai_messages.models import DailyMessage, SermonDocument, SermonEmbedding

from .models import Branch, StaffChange

CONTENT_ROLES = {"branch_admin", "content_editor"}
RECENT_CHANGES = 5


def _count(rows):
    """A per-branch count as a subquery, so counts of different things don't multiply."""
    counted = rows.order_by().values("minister__branch").annotate(n=Count("pk")).values("n")
    return Coalesce(Subquery(counted, output_field=IntegerField()), 0)


def visible_branches(user):
    rows = Branch.objects.filter(is_active=True)
    if user.is_superuser:
        return rows
    if user.branch_id and user.role in CONTENT_ROLES:
        return rows.filter(pk=user.branch_id)
    return rows.none()


class StaffOverviewView(APIView):
    permission_classes = [IsStaff]

    def get(self, request):
        user = request.user
        today = timezone.localdate()
        tomorrow = today + timedelta(days=1)
        here = OuterRef("pk")
        drafts = DailyMessage.objects.filter(minister__branch=here, status="pending_review", date__gte=today)
        read = SermonEmbedding.objects.filter(document=OuterRef("pk"), model=settings.GEMINI_EMBEDDING_MODEL)
        # Only sermons of ministers with AI drafts on are read (Task 4.2).
        waiting = SermonDocument.objects.filter(minister__branch=here, minister__ai_drafts=True).filter(~Exists(read))
        branches = (
            visible_branches(user)
            .annotate(
                ai_drafts=_count(drafts.filter(ai_generated=True)),
                drafts=_count(drafts),
                sermons_waiting=_count(waiting),
                tomorrow_published=Exists(DailyMessage.objects.filter(
                    minister__branch=here, status="published", date=tomorrow,
                )),
            )
            .order_by("name")
        )
        manages_requests = user.is_superuser or is_branch_admin(user)
        changes = None
        if user.is_superuser:
            changes = [
                {"username": c.username, "section": c.section, "action": c.action, "target": c.target,
                 "branch": c.branch.name if c.branch else "", "at": c.at}
                for c in StaffChange.objects.select_related("branch").order_by("-at", "-pk")[:RECENT_CHANGES]
            ]
        return Response({
            "today": today.isoformat(),
            "tomorrow": tomorrow.isoformat(),
            "branches": [
                {"slug": b.slug, "name": b.name, "ai_drafts": b.ai_drafts, "drafts": b.drafts,
                 "sermons_waiting": b.sermons_waiting, "tomorrow_published": b.tomorrow_published}
                for b in branches
            ],
            "requests_waiting": visible_requests(user).filter(status="waiting").count() if manages_requests else None,
            "recent_changes": changes,
        })
