from django.urls import path, include
from rest_framework.routers import DefaultRouter, SimpleRouter
from church_erp.core.views import BranchViewSet, MinisterViewSet
from church_erp.content.views import ActivityViewSet, AnnouncementViewSet, ProjectViewSet, SermonViewSet
from church_erp.media_library.views import MediaAssetViewSet
from church_erp.ai_messages.views import DailyMessageViewSet
from church_erp.ai_messages.staff_messages import StaffMessageViewSet
from church_erp.ai_messages.staff_writings import StaffWritingViewSet
from church_erp.media_library.staff_media import StaffMediaViewSet
from church_erp.accounts.staff_people import StaffPeopleViewSet
from church_erp.accounts.access_requests import RequestAccessView, StaffRequestViewSet
from church_erp.core.staff_branches import StaffBranchViewSet
from church_erp.core.changes import StaffChangeViewSet
from church_erp.core.staff_overview import StaffOverviewView
from church_erp.core.staff_presbyteries import StaffPresbyteryViewSet
from church_erp.workspace.meetings import CalendarFeedView, MeetingViewSet, calendar_feed
from church_erp.workspace.notify import NotificationViewSet
from church_erp.workspace.structure_views import AppointmentViewSet, BranchOfficeView, MeView as WorkspaceMeView, PeopleView, StructureView
from church_erp.finance.views import GivingRecordViewSet
from church_erp.api.views import backup_database, generate_daily_messages, sync_youtube
from church_erp.content.page_content_views import PageContentPageView, PageContentView, PageImageView
from church_erp.content.staff_content import (
    BranchDetailsView,
    StaffActivityViewSet,
    StaffAnnouncementViewSet,
    StaffMinisterViewSet,
    StaffProjectViewSet,
    StaffSermonViewSet,
    StaffServiceTimeViewSet,
)

router = DefaultRouter()
router.register(r'branches', BranchViewSet)
router.register(r'ministers', MinisterViewSet)
router.register(r'sermons', SermonViewSet)
router.register(r'projects', ProjectViewSet)
router.register(r'activities', ActivityViewSet)
router.register(r'announcements', AnnouncementViewSet)
router.register(r'media', MediaAssetViewSet)
router.register(r'daily-messages', DailyMessageViewSet)
router.register(r'giving-records', GivingRecordViewSet)

# The dashboard's addresses for one branch's content: /api/staff/<branch slug>/sermons/ and so on.
staff_router = SimpleRouter()
staff_router.register(r'staff/(?P<scope>[-a-zA-Z0-9_]+)/sermons', StaffSermonViewSet, basename='staff-sermons')
staff_router.register(r'staff/(?P<scope>[-a-zA-Z0-9_]+)/projects', StaffProjectViewSet, basename='staff-projects')
staff_router.register(r'staff/(?P<scope>[-a-zA-Z0-9_]+)/activities', StaffActivityViewSet, basename='staff-activities')
staff_router.register(r'staff/(?P<scope>[-a-zA-Z0-9_]+)/announcements', StaffAnnouncementViewSet, basename='staff-announcements')
staff_router.register(r'staff/(?P<scope>[-a-zA-Z0-9_]+)/ministers', StaffMinisterViewSet, basename='staff-ministers')
staff_router.register(r'staff/(?P<scope>[-a-zA-Z0-9_]+)/services', StaffServiceTimeViewSet, basename='staff-services')
staff_router.register(r'staff/(?P<scope>[-a-zA-Z0-9_]+)/messages', StaffMessageViewSet, basename='staff-messages')
staff_router.register(r'staff/(?P<scope>[-a-zA-Z0-9_]+)/writings', StaffWritingViewSet, basename='staff-writings')
staff_router.register(r'staff/(?P<scope>[-a-zA-Z0-9_]+)/media', StaffMediaViewSet, basename='staff-media')
staff_router.register(r'staff-people', StaffPeopleViewSet, basename='staff-people')
staff_router.register(r'staff-requests', StaffRequestViewSet, basename='staff-requests')
staff_router.register(r'staff-branches', StaffBranchViewSet, basename='staff-branches')
staff_router.register(r'staff-changes', StaffChangeViewSet, basename='staff-changes')
staff_router.register(r'staff-presbyteries', StaffPresbyteryViewSet, basename='staff-presbyteries')
# The shared workspace (AGENT_EXECUTION_PLAN.md, Phase 8).
staff_router.register(r'workspace/appointments', AppointmentViewSet, basename='workspace-appointments')
staff_router.register(r'workspace/meetings', MeetingViewSet, basename='workspace-meetings')
staff_router.register(r'workspace/notifications', NotificationViewSet, basename='workspace-notifications')

urlpatterns = [
    path('', include(router.urls)),
    path('', include(staff_router.urls)),
    path('auth/', include('church_erp.accounts.urls')),
    path('access-requests/', RequestAccessView.as_view(), name='access-request'),
    path('page-content/<slug:scope>/', PageContentView.as_view(), name='page-content'),
    path('page-content/<slug:scope>/<slug:page>/', PageContentPageView.as_view(), name='page-content-page'),
    path('page-content/<slug:scope>/<slug:page>/images/<slug:key>/', PageImageView.as_view(), name='page-image'),
    path('staff/<slug:scope>/details/', BranchDetailsView.as_view(), name='staff-branch-details'),
    path('staff-overview/', StaffOverviewView.as_view(), name='staff-overview'),
    path('workspace/me/', WorkspaceMeView.as_view(), name='workspace-me'),
    path('workspace/structure/', StructureView.as_view(), name='workspace-structure'),
    path('workspace/branches/<slug:slug>/', BranchOfficeView.as_view(), name='workspace-branch'),
    path('workspace/people/', PeopleView.as_view(), name='workspace-people'),
    path('workspace/calendar-feed/', CalendarFeedView.as_view(), name='workspace-calendar-feed'),
    path('workspace/calendar/<str:token>.ics', calendar_feed, name='workspace-calendar'),
    path('tasks/sync-youtube/', sync_youtube, name='sync-youtube'),
    path('tasks/daily-messages/', generate_daily_messages, name='generate-daily-messages'),
    path('tasks/backup/', backup_database, name='backup-database'),
]
