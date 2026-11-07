from django.urls import path, include
from rest_framework.routers import DefaultRouter, SimpleRouter
from church_erp.core.views import BranchViewSet, MinisterViewSet
from church_erp.content.views import SermonViewSet, ProjectViewSet, ActivityViewSet, PageViewSet
from church_erp.media_library.views import MediaAssetViewSet
from church_erp.ai_messages.views import DailyMessageViewSet
from church_erp.ai_messages.staff_messages import StaffMessageViewSet
from church_erp.media_library.staff_media import StaffMediaViewSet
from church_erp.finance.views import GivingRecordViewSet
from church_erp.api.views import sync_youtube
from church_erp.content.page_content_views import PageContentPageView, PageContentView, PageImageView
from church_erp.content.staff_content import (
    BranchDetailsView,
    StaffActivityViewSet,
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
router.register(r'pages', PageViewSet)
router.register(r'media', MediaAssetViewSet)
router.register(r'daily-messages', DailyMessageViewSet)
router.register(r'giving-records', GivingRecordViewSet)

# The dashboard's addresses for one branch's content: /api/staff/<branch slug>/sermons/ and so on.
staff_router = SimpleRouter()
staff_router.register(r'staff/(?P<scope>[-a-zA-Z0-9_]+)/sermons', StaffSermonViewSet, basename='staff-sermons')
staff_router.register(r'staff/(?P<scope>[-a-zA-Z0-9_]+)/projects', StaffProjectViewSet, basename='staff-projects')
staff_router.register(r'staff/(?P<scope>[-a-zA-Z0-9_]+)/activities', StaffActivityViewSet, basename='staff-activities')
staff_router.register(r'staff/(?P<scope>[-a-zA-Z0-9_]+)/ministers', StaffMinisterViewSet, basename='staff-ministers')
staff_router.register(r'staff/(?P<scope>[-a-zA-Z0-9_]+)/services', StaffServiceTimeViewSet, basename='staff-services')
staff_router.register(r'staff/(?P<scope>[-a-zA-Z0-9_]+)/messages', StaffMessageViewSet, basename='staff-messages')
staff_router.register(r'staff/(?P<scope>[-a-zA-Z0-9_]+)/media', StaffMediaViewSet, basename='staff-media')

urlpatterns = [
    path('', include(router.urls)),
    path('', include(staff_router.urls)),
    path('auth/', include('church_erp.accounts.urls')),
    path('page-content/<slug:scope>/', PageContentView.as_view(), name='page-content'),
    path('page-content/<slug:scope>/<slug:page>/', PageContentPageView.as_view(), name='page-content-page'),
    path('page-content/<slug:scope>/<slug:page>/images/<slug:key>/', PageImageView.as_view(), name='page-image'),
    path('staff/<slug:scope>/details/', BranchDetailsView.as_view(), name='staff-branch-details'),
    path('tasks/sync-youtube/', sync_youtube, name='sync-youtube'),
]
