from rest_framework import viewsets
from church_erp.core.api_mixins import BranchScopedViewSetMixin, IsBranchStaffOrReadOnly
from church_erp.core.models import Branch, Minister
from church_erp.core.serializers import BranchSerializer, MinisterSerializer


class BranchViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Branch.objects.filter(is_active=True)
    serializer_class = BranchSerializer
    lookup_field = 'slug'


class MinisterViewSet(BranchScopedViewSetMixin, viewsets.ModelViewSet):
    queryset = Minister.objects.all()
    serializer_class = MinisterSerializer
    permission_classes = [IsBranchStaffOrReadOnly]
