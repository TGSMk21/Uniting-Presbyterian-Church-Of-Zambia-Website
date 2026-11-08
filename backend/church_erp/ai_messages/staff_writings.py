"""Written sermons from the dashboard (AGENT_EXECUTION_PLAN.md, Task 4.1).

Pastors' sermons are private to their branch's staff and never shown on the
website. Staff paste the words in, or add Word, PDF or text files one after
another, and the daily message pipeline reads them (Task 4.2)."""
import logging
import uuid

from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.files.base import ContentFile
from django.db import transaction
from rest_framework import serializers, status
from rest_framework.decorators import action
from rest_framework.parsers import JSONParser, MultiPartParser
from rest_framework.response import Response

from church_erp.content.staff_content import BranchContentViewSet
from church_erp.core.changes import record
from church_erp.core.models import Minister

from . import sermon_text
from .models import SermonDocument
from .sermon_text import sermon_file_text, tidy, title_from_name

logger = logging.getLogger(__name__)


class SermonWordsField(serializers.CharField):
    """Tidied like a file's words, then checked for length."""

    def __init__(self, **kwargs):
        super().__init__(max_length=None, trim_whitespace=False, **kwargs)

    def to_internal_value(self, data):
        text = tidy(super().to_internal_value(data))
        if not text:
            raise serializers.ValidationError("Please paste the sermon's words.")
        if len(text) > sermon_text.MAX_TEXT:
            raise serializers.ValidationError(sermon_text.TOO_LONG)
        return text


class BranchMinisterField(serializers.PrimaryKeyRelatedField):
    """Only this branch's ministers can be chosen."""

    def get_queryset(self):
        branch = self.context.get("branch")
        return Minister.objects.filter(branch=branch) if branch is not None else Minister.objects.none()


class WritingSerializer(serializers.ModelSerializer):
    minister = BranchMinisterField()
    minister_name = serializers.CharField(source="minister.name", read_only=True)
    # Sermons are only read, and sent to Gemini, for ministers with AI drafts on.
    minister_ai_drafts = serializers.BooleanField(source="minister.ai_drafts", read_only=True)
    text = SermonWordsField()
    word_count = serializers.SerializerMethodField()
    ready = serializers.SerializerMethodField()

    class Meta:
        model = SermonDocument
        fields = [
            "id", "minister", "minister_name", "minister_ai_drafts", "title", "preached_on", "text",
            "source_name", "file_kind", "word_count", "ready", "created_at",
        ]
        read_only_fields = ["source_name", "file_kind", "created_at"]

    def get_word_count(self, obj):
        return len(obj.text.split())

    def get_ready(self, obj):
        # Read for the daily messages with today's embedding model (Task 4.2).
        from .embeddings import is_embedded
        return is_embedded(obj)


class WritingListSerializer(WritingSerializer):
    """The list and export leave out the full words, which can be long."""

    class Meta(WritingSerializer.Meta):
        fields = [name for name in WritingSerializer.Meta.fields if name != "text"]


class WritingUploadSerializer(serializers.Serializer):
    file = serializers.FileField()
    minister = BranchMinisterField()
    title = serializers.CharField(max_length=sermon_text.TITLE_LENGTH, required=False)
    preached_on = serializers.DateField(required=False, allow_null=True)

    def validate_file(self, uploaded):
        try:
            self.read = sermon_file_text(uploaded)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.messages)
        return uploaded


def delete_quietly(storage, name):
    """A file left behind costs little, so a failure here shouldn't fail the request."""
    if not name:
        return
    try:
        storage.delete(name)
    except Exception:
        logger.exception("Couldn't delete the written sermon file %s", name)


class StaffWritingViewSet(BranchContentViewSet):
    queryset = SermonDocument.objects.select_related("minister").order_by("-created_at", "-pk")
    serializer_class = WritingSerializer
    parser_classes = [JSONParser, MultiPartParser]
    ordering_fields = ["created_at", "preached_on", "title"]

    def get_queryset(self):
        return self.queryset.filter(minister__branch=self.branch)

    def get_serializer_class(self):
        if self.action in ("list", "export"):
            return WritingListSerializer
        return WritingSerializer

    def perform_create(self, serializer):
        serializer.save(uploaded_by=self.request.user)

    def perform_update(self, serializer):
        old_text = serializer.instance.text
        with transaction.atomic():
            document = serializer.save()
            if document.text != old_text:
                # New words are read again for the daily messages.
                document.embeddings.all().delete()

    def perform_destroy(self, instance):
        storage, name = instance.source_file.storage, instance.source_file.name
        instance.delete()
        delete_quietly(storage, name)

    @action(detail=False, methods=["post"], parser_classes=[MultiPartParser])
    def upload(self, request, *args, **kwargs):
        """One file at a time; the dashboard sends a pastor's backlog one after another."""
        upload = WritingUploadSerializer(data=request.data, context=self.get_serializer_context())
        upload.is_valid(raise_exception=True)
        uploaded = upload.validated_data["file"]
        text, kind = upload.read
        original_name = (uploaded.name or "").replace("\\", "/").split("/")[-1][:255]

        storage = SermonDocument._meta.get_field("source_file").storage
        uploaded.seek(0)
        name = storage.save(f"sermon_documents/{uuid.uuid4().hex}.{kind}", ContentFile(uploaded.read()))
        try:
            document = SermonDocument.objects.create(
                minister=upload.validated_data["minister"],
                title=upload.validated_data.get("title") or title_from_name(original_name),
                preached_on=upload.validated_data.get("preached_on"),
                text=text,
                source_file=name,
                source_name=original_name,
                file_kind=kind,
                uploaded_by=request.user,
            )
        except Exception:
            delete_quietly(storage, name)
            raise
        record(request.user, "writings", "added", branch=self.branch, target=document.title, target_id=document.pk)
        return Response(WritingSerializer(document, context=self.get_serializer_context()).data, status=status.HTTP_201_CREATED)
