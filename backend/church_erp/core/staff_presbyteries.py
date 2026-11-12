"""Presbyteries from the dashboard, for superusers (AGENT_EXECUTION_PLAN.md, Task 8.1)."""
from django.utils.text import slugify
from rest_framework import serializers, viewsets

from church_erp.accounts.auth_views import IsStaff

from .changes import IsSuperuser, record
from .models import Presbytery


class PresbyterySerializer(serializers.ModelSerializer):
    branch_count = serializers.SerializerMethodField()

    class Meta:
        model = Presbytery
        fields = ["id", "name", "slug", "order", "branch_count"]
        read_only_fields = ["slug"]

    def get_branch_count(self, obj):
        return obj.branches.filter(is_active=True).count()

    def validate_name(self, value):
        name = value.strip()
        clash = Presbytery.objects.filter(name__iexact=name)
        if self.instance is not None:
            clash = clash.exclude(pk=self.instance.pk)
        if not name or clash.exists():
            raise serializers.ValidationError("Another presbytery already has this name.")
        return name

    def create(self, validated_data):
        base = slugify(validated_data["name"].replace("'", "")) or "presbytery"
        slug, n = base, 2
        while Presbytery.objects.filter(slug=slug).exists():
            slug, n = f"{base}-{n}", n + 1
        if "order" not in validated_data:
            # A new presbytery goes at the end of the list.
            last = Presbytery.objects.order_by("-order").values_list("order", flat=True).first() or 0
            validated_data["order"] = last + 1
        return Presbytery.objects.create(slug=slug, **validated_data)


class StaffPresbyteryViewSet(viewsets.ModelViewSet):
    http_method_names = ["get", "post", "patch", "head", "options"]
    serializer_class = PresbyterySerializer
    permission_classes = [IsStaff, IsSuperuser]
    queryset = Presbytery.objects.all()

    def perform_create(self, serializer):
        presbytery = serializer.save()
        record(self.request.user, "presbyteries", "added", target=presbytery.name, target_id=presbytery.pk)

    def perform_update(self, serializer):
        presbytery = serializer.save()
        record(self.request.user, "presbyteries", "changed", target=presbytery.name, target_id=presbytery.pk,
               changes=list(serializer.validated_data))
