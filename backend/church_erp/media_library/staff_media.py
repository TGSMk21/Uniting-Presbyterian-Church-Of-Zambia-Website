"""The media library from the dashboard (AGENT_EXECUTION_PLAN.md, Task 5.3).

Files stay in the private bucket. The API only ever hands out signed links,
which expire after an hour (settings/storage.py)."""
import logging
import os
import uuid

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.db.models import Q
from rest_framework import serializers
from rest_framework.decorators import action
from rest_framework.parsers import JSONParser, MultiPartParser
from rest_framework.response import Response

from church_erp.content.staff_content import BranchContentViewSet

from .models import MediaAsset, MediaTag
from .uploads import checked_upload

logger = logging.getLogger(__name__)

MAX_TAGS = 10
TAG_LENGTH = 100
DESCRIPTION_LENGTH = 2000
KINDS = {
    "webp": "Photo", "pdf": "PDF", "docx": "Word", "xlsx": "Excel", "pptx": "PowerPoint",
    "mp3": "MP3", "m4a": "M4A",
}


class TagsField(serializers.Field):
    """Typed as "Easter, Youth"; answered as a list of names."""

    def to_internal_value(self, data):
        if not isinstance(data, str):
            raise serializers.ValidationError("Type the tags with commas between them.")
        names = []
        for name in (part.strip() for part in data.split(",")):
            if not name or name.lower() in (n.lower() for n in names):
                continue
            if len(name) > TAG_LENGTH:
                raise serializers.ValidationError(f"Each tag can be up to {TAG_LENGTH} characters.")
            names.append(name)
        if len(names) > MAX_TAGS:
            raise serializers.ValidationError(f"A file can have up to {MAX_TAGS} tags.")
        return names

    def to_representation(self, value):
        return sorted(tag.name for tag in value.all())


def tags_named(names):
    """Existing tags are reused whatever their capitals; new ones are created."""
    tags = []
    for name in names:
        tag = MediaTag.objects.filter(name__iexact=name).first() or MediaTag.objects.create(name=name)
        tags.append(tag)
    return tags


def delete_quietly(storage, name):
    """A file left behind costs little, so a failure here shouldn't fail the request."""
    if not name:
        return
    try:
        storage.delete(name)
    except Exception:
        logger.exception("Couldn't delete the media library file %s", name)


class StaffMediaSerializer(serializers.ModelSerializer):
    file = serializers.FileField(write_only=True)
    # Trimmed, and refused when empty, by DRF itself.
    title = serializers.CharField(max_length=200, required=False)
    description = serializers.CharField(max_length=DESCRIPTION_LENGTH, allow_blank=True, required=False)
    tags = TagsField(required=False)
    url = serializers.SerializerMethodField()
    kind = serializers.SerializerMethodField()
    uploaded_by_name = serializers.SerializerMethodField()

    class Meta:
        model = MediaAsset
        fields = [
            "id", "file", "title", "description", "tags", "file_type", "kind", "url",
            "uploaded_by_name", "uploaded_at",
        ]
        read_only_fields = ["file_type", "uploaded_at"]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # The file is chosen once; after that only its wording and tags change.
        if self.instance is not None:
            self.fields.pop("file")

    def get_url(self, obj):
        # A signed link in production, which expires after an hour. Locally it's a
        # path on the API, so it's made into a full address the browser can open.
        if not obj.file:
            return ""
        request = self.context.get("request")
        return request.build_absolute_uri(obj.file.url) if request else obj.file.url

    def get_kind(self, obj):
        extension = os.path.splitext(obj.file.name)[1].lstrip(".").lower()
        return KINDS.get(extension, extension.upper())

    def get_uploaded_by_name(self, obj):
        person = obj.uploaded_by
        if person is None:
            return ""
        return person.get_full_name() or person.username

    def validate_file(self, uploaded):
        try:
            self.checked = checked_upload(uploaded)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.messages)
        return uploaded

    def create(self, validated_data):
        uploaded = validated_data.pop("file")
        names = validated_data.pop("tags", [])
        content, file_type, extension = self.checked
        if not validated_data.get("title"):
            stem = os.path.splitext(os.path.basename(uploaded.name or ""))[0].strip()
            validated_data["title"] = stem[:200] or "Untitled"
        storage = MediaAsset._meta.get_field("file").storage
        name = storage.save(f"media_library/{uuid.uuid4().hex}.{extension}", content)
        try:
            with transaction.atomic():
                asset = MediaAsset.objects.create(file=name, file_type=file_type, **validated_data)
                asset.tags.set(tags_named(names))
        except Exception:
            delete_quietly(storage, name)
            raise
        return asset

    def update(self, instance, validated_data):
        names = validated_data.pop("tags", None)
        with transaction.atomic():
            instance = super().update(instance, validated_data)
            if names is not None:
                instance.tags.set(tags_named(names))
        return instance


class StaffMediaViewSet(BranchContentViewSet):
    queryset = MediaAsset.objects.select_related("uploaded_by").prefetch_related("tags").order_by("-uploaded_at", "-pk")
    serializer_class = StaffMediaSerializer
    parser_classes = [MultiPartParser, JSONParser]
    # Signed links open private files, so they stay out of exports.
    export_exclude = ("url",)

    def get_queryset(self):
        rows = super().get_queryset()
        params = self.request.query_params
        if params.get("type") in ("image", "document", "audio"):
            rows = rows.filter(file_type=params["type"])
        tag = params.get("tag", "").strip()
        if tag:
            rows = rows.filter(tags__name__iexact=tag)
        words = params.get("q", "").strip()
        if words:
            rows = rows.filter(Q(title__icontains=words) | Q(description__icontains=words))
        return rows.distinct()

    def perform_create(self, serializer):
        serializer.save(branch=self.branch, uploaded_by=self.request.user)

    def perform_destroy(self, instance):
        storage = instance.file.storage
        name = instance.file.name
        instance.delete()
        delete_quietly(storage, name)

    @action(detail=False)
    def tags(self, request, *args, **kwargs):
        # Only the tags this branch uses, for the filter.
        names = (
            MediaTag.objects.filter(mediaasset__branch=self.branch)
            .values_list("name", flat=True).distinct().order_by("name")
        )
        return Response(list(names))
