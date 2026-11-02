from rest_framework import viewsets, permissions
from church_erp.core.models import Branch, Minister
from church_erp.core.serializers import BranchSerializer, MinisterSerializer


class BranchViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Branch.objects.filter(is_active=True)
    serializer_class = BranchSerializer
    lookup_field = 'slug'


class MinisterViewSet(viewsets.ModelViewSet):
    queryset = Minister.objects.all()
    serializer_class = MinisterSerializer

    def get_queryset(self):
        qs = Minister.objects.all()
        branch_slug = self.request.query_params.get('branch')
        if branch_slug:
            qs = qs.filter(branch__slug=branch_slug)
        return qs

    def perform_create(self, serializer):
        serializer.save()
