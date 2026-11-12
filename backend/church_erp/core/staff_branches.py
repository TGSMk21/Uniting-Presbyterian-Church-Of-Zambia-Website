"""Branches from the dashboard, for superusers (AGENT_EXECUTION_PLAN.md, Task 5.4).

A branch's web address (its slug) is set once: links, cached pages and
search results all point at it. Everything else about a branch is changed by
its own staff in the dashboard."""
import re

from django.db.models import Count, Q
from rest_framework import serializers, viewsets

from church_erp.accounts.auth_views import IsStaff

from .changes import IsSuperuser, changed, editable_names, record
from .models import Branch, Presbytery
from .validators import RESERVED_BRANCH_SLUGS

CHANNEL = re.compile(r"UC[A-Za-z0-9_-]{22}")
SLUG = re.compile(r"[a-z0-9]+(-[a-z0-9]+)*")


class StaffBranchSerializer(serializers.ModelSerializer):
    name = serializers.CharField(max_length=200)
    slug = serializers.CharField(max_length=50)
    contact_email = serializers.EmailField(allow_blank=True, required=False)
    youtube_channel_id = serializers.CharField(max_length=24, allow_blank=True, required=False)
    staff_count = serializers.IntegerField(read_only=True, default=0)
    # Which presbytery it belongs to (Task 8.1).
    presbytery = serializers.SlugRelatedField(slug_field="slug", queryset=Presbytery.objects.all(),
                                              allow_null=True, required=False)

    class Meta:
        model = Branch
        fields = ["id", "name", "slug", "contact_email", "youtube_channel_id", "is_active", "presbytery", "staff_count",
                  "created_at"]
        read_only_fields = ["created_at"]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if isinstance(self.instance, Branch):
            self.fields["slug"].read_only = True
        else:
            # A new branch starts switched on.
            self.fields["is_active"].read_only = True

    def validate_slug(self, value):
        slug = value.strip().lower()
        if not SLUG.fullmatch(slug):
            raise serializers.ValidationError(
                "Use small letters, numbers and dashes only, like st-pauls-kabwe."
            )
        if slug in RESERVED_BRANCH_SLUGS:
            raise serializers.ValidationError("The website already uses this address. Please choose another.")
        if Branch.objects.filter(slug=slug).exists():
            raise serializers.ValidationError("Another branch already has this address.")
        return slug

    def validate_youtube_channel_id(self, value):
        value = value.strip()
        if value and not CHANNEL.fullmatch(value):
            raise serializers.ValidationError(
                "This should be the channel's ID: UC followed by 22 letters and numbers. "
                "It's at the end of the channel's address on YouTube, not its @name."
            )
        return value


class StaffBranchViewSet(viewsets.ModelViewSet):
    serializer_class = StaffBranchSerializer
    permission_classes = [IsStaff, IsSuperuser]
    http_method_names = ["get", "post", "patch", "head", "options"]
    lookup_field = "slug"

    def perform_create(self, serializer):
        branch = serializer.save()
        record(self.request.user, "branches", "added", branch=branch, target=branch.name, target_id=branch.pk)

    def perform_update(self, serializer):
        before = dict(self.get_serializer(serializer.instance).data)
        names = editable_names(serializer)
        branch = serializer.save()
        changes = changed(before, self.get_serializer(branch).data, names)
        if changes:
            record(self.request.user, "branches", "changed", branch=branch, target=branch.name,
                   target_id=branch.pk, changes=changes)

    def get_queryset(self):
        return Branch.objects.annotate(
            staff_count=Count("staff", filter=Q(staff__is_active=True), distinct=True),
        ).order_by("name")
