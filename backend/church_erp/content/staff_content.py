"""Sermons, projects, activities, ministers and service times, managed by branch
staff from the dashboard.

The public addresses (/api/sermons/ and so on) are read-only, so every change goes
through here, under /api/staff/<branch>/. Who may manage a branch follows the same
rule as its pages (`page_content.can_edit`).
"""
import re
import uuid
from decimal import ROUND_HALF_UP, Decimal, InvalidOperation
from urllib.parse import parse_qs, urlsplit

from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.files.storage import default_storage
from django.db import IntegrityError, transaction
from django.shortcuts import get_object_or_404
from rest_framework import serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import APIException, PermissionDenied
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from church_erp.accounts.auth_views import IsStaff
from church_erp.core.models import Branch, Minister, ServiceTime

from .models import Activity, Project, Sermon
from .page_content import can_edit
from .page_images import delete_quietly, prepared_image

VIDEO_ID = re.compile(r"[A-Za-z0-9_-]{11}")
YOUTUBE_HOSTS = {
    "youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com",
    "youtube-nocookie.com", "www.youtube-nocookie.com",
}
VIDEO_PATHS = {"live", "shorts", "embed", "v"}
LONG_TEXT = 5000  # YouTube's own limit for a description
MINISTER_PHOTO_SIDE = 800
MAX_ORDER = 999


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


class MinisterSerializer(serializers.ModelSerializer):
    bio = serializers.CharField(max_length=LONG_TEXT, allow_blank=True, required=False)

    class Meta:
        model = Minister
        fields = ["id", "name", "bio", "order", "photo"]
        # Photos change through their own upload, which checks them.
        read_only_fields = ["photo"]
        extra_kwargs = {"order": {"min_value": 0, "max_value": MAX_ORDER}}


class ServiceTimeSerializer(serializers.ModelSerializer):
    class Meta:
        model = ServiceTime
        fields = ["id", "day", "title", "start_time", "end_time", "location", "details", "order"]
        extra_kwargs = {"order": {"min_value": 0, "max_value": MAX_ORDER}}

    def validate(self, attrs):
        start = attrs.get("start_time", getattr(self.instance, "start_time", None))
        end = attrs.get("end_time", getattr(self.instance, "end_time", None))
        if start and end and end <= start:
            raise serializers.ValidationError({"end_time": ["The end time must be after the start time."]})
        return attrs


class HasDailyMessages(APIException):
    status_code = status.HTTP_409_CONFLICT
    default_detail = "This minister has daily messages, so they can't be deleted."


class StaffMinisterViewSet(BranchContentViewSet):
    queryset = Minister.objects.order_by("order", "name", "pk")
    serializer_class = MinisterSerializer

    def perform_destroy(self, instance):
        # Deleting a minister would delete their daily messages with them.
        if instance.daily_messages.exists():
            raise HasDailyMessages()
        photo = instance.photo.name
        instance.delete()
        delete_quietly(photo)

    @action(detail=True, methods=["post", "delete"], parser_classes=[MultiPartParser])
    def photo(self, request, *args, **kwargs):
        minister = self.get_object()
        previous = minister.photo.name
        if request.method == "DELETE":
            Minister.objects.filter(pk=minister.pk).update(photo="")
            delete_quietly(previous)
            return Response({"url": ""})

        uploaded = request.FILES.get("image")
        if not uploaded:
            raise serializers.ValidationError({"image": ["Please choose a photo."]})
        try:
            content = prepared_image(uploaded, MINISTER_PHOTO_SIDE)
        except DjangoValidationError as exc:
            raise serializers.ValidationError({"image": exc.messages})
        name = default_storage.save(f"ministers/{uuid.uuid4().hex}.webp", content)
        try:
            Minister.objects.filter(pk=minister.pk).update(photo=name)
        except Exception:
            delete_quietly(name)
            raise
        delete_quietly(previous)
        return Response({"url": request.build_absolute_uri(default_storage.url(name))})


class StaffServiceTimeViewSet(BranchContentViewSet):
    queryset = ServiceTime.objects.order_by("order", "start_time", "pk")
    serializer_class = ServiceTimeSerializer


# Branch details: contact details and the map position for Find a Branch.
# The name, address in the website and YouTube channel stay with superusers in the admin.
ZAMBIA_LATITUDE = (Decimal("-18.5"), Decimal("-8.0"))
ZAMBIA_LONGITUDE = (Decimal("21.5"), Decimal("34.0"))
PHONE = re.compile(r"[0-9+()\- ]*")


class PositionField(serializers.DecimalField):
    """Six decimal places is about 10 cm. A map click gives more, so they're rounded."""

    def __init__(self, **kwargs):
        super().__init__(max_digits=9, decimal_places=6, allow_null=True, required=False, **kwargs)

    def to_internal_value(self, data):
        try:
            data = Decimal(str(data).strip()).quantize(Decimal("0.000001"), rounding=ROUND_HALF_UP)
        except (InvalidOperation, ValueError):
            self.fail("invalid")
        return super().to_internal_value(data)


class BranchDetailsSerializer(serializers.ModelSerializer):
    address = serializers.CharField(max_length=500, allow_blank=True, required=False)
    latitude = PositionField()
    longitude = PositionField()

    class Meta:
        model = Branch
        fields = ["name", "slug", "contact_email", "contact_phone", "address", "latitude", "longitude", "location_confirmed"]
        read_only_fields = ["name", "slug"]

    def validate_contact_phone(self, value):
        if not PHONE.fullmatch(value):
            raise serializers.ValidationError("Please use only numbers, spaces and + - ( ).")
        return value

    def validate(self, attrs):
        def final(key):
            return attrs[key] if key in attrs else getattr(self.instance, key)

        latitude, longitude = final("latitude"), final("longitude")
        if (latitude is None) != (longitude is None):
            raise serializers.ValidationError({"latitude": ["Please give both parts of the position, or clear both."]})
        if latitude is not None and not (
            ZAMBIA_LATITUDE[0] <= latitude <= ZAMBIA_LATITUDE[1]
            and ZAMBIA_LONGITUDE[0] <= longitude <= ZAMBIA_LONGITUDE[1]
        ):
            raise serializers.ValidationError({"latitude": ["This position is outside Zambia. Please check it."]})
        if final("location_confirmed") and latitude is None:
            raise serializers.ValidationError({"location_confirmed": ["Set the map position before confirming it."]})
        return attrs


class BranchDetailsView(APIView):
    permission_classes = [IsStaff]

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        self.branch = get_object_or_404(Branch, slug=kwargs["scope"], is_active=True)
        if not can_edit(request.user, self.branch):
            raise PermissionDenied("You can't manage this branch's details.")

    def get(self, request, scope):
        return Response(BranchDetailsSerializer(self.branch).data)

    def patch(self, request, scope):
        serializer = BranchDetailsSerializer(self.branch, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)
