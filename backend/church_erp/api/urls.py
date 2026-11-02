from django.urls import path, include
from rest_framework.routers import DefaultRouter
from church_erp.core.views import BranchViewSet, MinisterViewSet
from church_erp.content.views import SermonViewSet, ProjectViewSet, ActivityViewSet, PageViewSet
from church_erp.media_library.views import MediaAssetViewSet
from church_erp.ai_messages.views import DailyMessageViewSet
from church_erp.finance.views import GivingRecordViewSet
from church_erp.api.views import sync_youtube

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

urlpatterns = [
    path('', include(router.urls)),
    path('auth/', include('church_erp.accounts.urls')),
    path('tasks/sync-youtube/', sync_youtube, name='sync-youtube'),
]
