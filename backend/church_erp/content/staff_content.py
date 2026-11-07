"""Sermons, projects and activities, managed by branch staff from the dashboard.

The public addresses (/api/sermons/ and so on) are read-only, so every change goes
through here, under /api/staff/<branch>/. Who may manage a branch follows the same
rule as its pages (`page_content.can_edit`).
"""
import re
from urllib.parse import parse_qs, urlsplit

from django.db import IntegrityError, transaction
from django.shortcuts import get_object_or_404
from rest_framework import serializers, viewsets
from rest_framework.exceptions import PermissionDenied

from church_erp.accounts.auth_views import IsStaff
from church_erp.core.models import Branch

from .models import Activity, Project, Sermon
from .page_content import can_edit

VIDEO_ID = re.compile(r"[A-Za-z0-9_-]{11}")
YOUTUBE_HOSTS = {
    "youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com",
    "youtube-nocookie.com", "www.youtube-nocookie.com",
}
VIDEO_PATHS = {"live", "shorts", "embed", "v"}
LONG_TEXT = 5000  # YouTube's own limit for a description


def video_id_from(text):
    """The video ID in a YouTube link, or a bare ID; None for anything else."""
    text = text.strip()
    if VIDEO_ID.fullmatch(text):
        return text
    try:
        url = urlsplit(text if "://" in text else f"https://{text}")
        host = url.hostname or ""
    except ValueError:
        return None
    if url.scheme not in ("http", "https"):
        return None
    parts = [part for part in url.path.split("/") if part]
    candidate = ""
    if host == "youtu.be" and parts:
        candidate = parts[0]
    elif host in YOUTUBE_HOSTS:
        if parts == ["watch"]:
            candidate = parse_qs(url.query).get("v", [""])[0]
        elif len(parts) >= 2 and parts[0] in VIDEO_PATHS:
            candidate = parts[1]
    return candidate if VIDEO_ID.fullmatch(candidate) else None


class SermonSerializer(serializers.ModelSerializer):
    # A YouTube link or ID, only when adding: changing it later would leave the
    # sync to import the old video again.
    video = serializers.CharField(write_only=True, max_length=300)
    description = serializers.CharField(max_length=LONG_TEXT, allow_blank=True, required=False)

    class Meta:
        model = Sermon
        fields = [
            "id", "title", "series", "reference_verse", "description", "preached_at",
            "video", "video_id", "duration", "is_live", "is_hidden",
        ]
        read_only_fields = ["video_id", "duration", "is_live"]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if isinstance(self.instance, Sermon):
            self.fields.pop("video")

    def validate_video(self, value):
        video_id = video_id_from(value)
        if not video_id:
            raise serializers.ValidationError("Please paste the link to a YouTube video.")
        if Sermon.objects.filter(branch=self.context["branch"], video_id=video_id).exists():
            raise serializers.ValidationError("This video is already in your sermons.")
        return video_id

    def create(self, validated_data):
        validated_data["video_id"] = validated_data.pop("video")
        try:
            with transaction.atomic():
                return super().create(validated_data)
        except IntegrityError:
            # Added by someone else, or by the YouTube sync, a moment ago.
            raise serializers.ValidationError({"video": ["This video is already in your sermons."]})


class ProjectSerializer(serializers.ModelSerializer):
    description = serializers.CharField(max_length=LONG_TEXT)

    class Meta:
        model = Project
        fields = ["id", "title", "status", "description", "start_date", "end_date", "progress"]
        extra_kwargs = {"progress": {"min_value": 0, "max_value": 100}}

    def validate(self, attrs):
        start = attrs.get("start_date", getattr(self.instance, "start_date", None))
        end = attrs.get("end_date", getattr(self.instance, "end_date", None))
        if start and end and end < start:
            raise serializers.ValidationError({"end_date": ["The end date can't be before the start date."]})
        return attrs


class ActivitySerializer(serializers.ModelSerializer):
    details = serializers.CharField(max_length=LONG_TEXT)

    class Meta:
        model = Activity
        fields = ["id", "title", "date", "start_time", "end_time", "details", "location"]

    def validate(self, attrs):
        start = attrs.get("start_time", getattr(self.instance, "start_time", None))
        end = attrs.get("end_time", getattr(self.instance, "end_time", None))
        if start and end and end <= start:
            raise serializers.ValidationError({"end_time": ["The end time must be after the start time."]})
        return attrs


class BranchContentViewSet(viewsets.ModelViewSet):
    """One branch's rows, chosen by the branch slug in the address."""
    permission_classes = [IsStaff]

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        self.branch = get_object_or_404(Branch, slug=kwargs["scope"], is_active=True)
        if not can_edit(request.user, self.branch):
            raise PermissionDenied("You can't manage this branch's content.")

    def get_queryset(self):
        return self.queryset.filter(branch=self.branch)

    def get_serializer_context(self):
        return {**super().get_serializer_context(), "branch": getattr(self, "branch", None)}

    def perform_create(self, serializer):
        serializer.save(branch=self.branch)


class StaffSermonViewSet(BranchContentViewSet):
    # No deleting: the YouTube sync would bring the sermon back. Staff hide it instead.
    http_method_names = ["get", "post", "put", "patch", "head", "options"]
    queryset = Sermon.objects.order_by("-preached_at", "-pk")
    serializer_class = SermonSerializer


class StaffProjectViewSet(BranchContentViewSet):
    queryset = Project.objects.order_by("-created_at", "-pk")
    serializer_class = ProjectSerializer


class StaffActivityViewSet(BranchContentViewSet):
    queryset = Activity.objects.order_by("-date", "-start_time", "-pk")
    serializer_class = ActivitySerializer
