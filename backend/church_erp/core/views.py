from rest_framework import permissions, viewsets
from church_erp.core.api_mixins import BranchScopedViewSetMixin
from church_erp.core.models import Branch, Minister
from church_erp.core.serializers import BranchSerializer, MinisterSerializer


class BranchViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Branch.objects.filter(is_active=True)
    serializer_class = BranchSerializer
    lookup_field = 'slug'


# Read-only: staff change ministers through the dashboard (content/staff_content.py).
class MinisterViewSet(BranchScopedViewSetMixin, viewsets.ReadOnlyModelViewSet):
    queryset = Minister.objects.all()
    serializer_class = MinisterSerializer
    permission_classes = [permissions.AllowAny]
