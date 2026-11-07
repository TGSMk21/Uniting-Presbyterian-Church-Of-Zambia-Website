"""Test-only builders for branch-scoped data and staff users."""
from datetime import date, time
from decimal import Decimal

from django.contrib.auth.models import Permission
from django.utils import timezone

from church_erp.accounts.models import User
from church_erp.ai_messages.models import DailyMessage, SermonDocument
from church_erp.content.models import Activity, Page, Project, Sermon
from church_erp.core.models import Branch, Minister
from church_erp.finance.models import GivingRecord
from church_erp.media_library.models import MediaAsset

CONTENT_APPS = ("core", "content", "media_library", "ai_messages")


def make_branch(slug):
    return Branch.objects.create(
        name=slug.title(),
        slug=slug,
        contact_email=f"{slug}@example.org",
        contact_phone="0000",
        address=f"{slug.title()} Road",
    )


def make_staff(username, branch, role, apps=CONTENT_APPS):
    """A staff user holding every Django model permission for `apps`."""
    user = User.objects.create_user(
        username=username, password="pw", is_staff=True, branch=branch, role=role
    )
    user.user_permissions.set(
        Permission.objects.filter(content_type__app_label__in=apps)
    )
    return user


def make_branch_content(branch, recorded_by):
    """One record of every branch-scoped model, keyed by model name."""
    minister = Minister.objects.create(branch=branch, name=f"Rev {branch.slug}")
    sermon = Sermon.objects.create(
        branch=branch,
        minister=minister,
        title=f"{branch.slug} sermon",
        video_id=f"{branch.slug}-vid",
        preached_at=timezone.now(),
    )
    return {
        "minister": minister,
        "sermon": sermon,
        "project": Project.objects.create(
            branch=branch,
            title=f"{branch.slug} project",
            description="d",
            start_date=date(2026, 1, 1),
        ),
        "activity": Activity.objects.create(
            branch=branch,
            title=f"{branch.slug} activity",
            start_time=time(9),
            end_time=time(10),
            date=date(2026, 1, 1),
            details="d",
            location="Hall",
        ),
        "page": Page.objects.create(branch=branch, slug="about", title="About"),
        "mediaasset": MediaAsset.objects.create(
            branch=branch, file="media_library/x.jpg", file_type="image", title="x"
        ),
        "dailymessage": DailyMessage.objects.create(
            minister=minister, title="Word", message="m", date=date(2026, 1, 1)
        ),
        "sermondocument": SermonDocument.objects.create(
            minister=minister, title=f"{branch.slug} written sermon", text="Words"
        ),
        "givingrecord": GivingRecord.objects.create(
            branch=branch,
            amount=Decimal("10.00"),
            giving_type="tithe",
            payment_method="cash",
            reference_number=f"{branch.slug}-ref-1",
            recorded_by=recorded_by,
        ),
    }
