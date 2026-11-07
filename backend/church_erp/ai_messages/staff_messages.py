"""Daily messages from the dashboard (AGENT_EXECUTION_PLAN.md, Task 5.3).

Staff write a message, keep it as a draft, and publish it when it's ready.
Phase 4 will add AI drafts to the same list for staff to check and publish."""
from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework import serializers

from church_erp.content.staff_content import BranchContentViewSet
from church_erp.core.models import Minister

from .models import DailyMessage

MESSAGE_TEXT = 10000
VERSE_TEXT = 2000
SAME_DAY = "This minister already has a published message for this day. Unpublish that one first."


class StaffMessageSerializer(serializers.ModelSerializer):
    minister = serializers.PrimaryKeyRelatedField(queryset=Minister.objects.none())
    minister_name = serializers.CharField(source="minister.name", read_only=True)
    message = serializers.CharField(max_length=MESSAGE_TEXT)
    verse_text = serializers.CharField(max_length=VERSE_TEXT, allow_blank=True, required=False)
    reviewed_by_name = serializers.SerializerMethodField()
    # AI drafts (Task 4.3) say so, and which written sermons they came from.
    source_titles = serializers.SerializerMethodField()

    class Meta:
        model = DailyMessage
        fields = [
            "id", "minister", "minister_name", "title", "message", "reference_verse", "verse_text",
            "date", "status", "reviewed_by_name", "published_at", "created_at",
            "ai_generated", "source_titles",
        ]
        read_only_fields = ["published_at", "created_at", "ai_generated"]
        # One published message per minister per day is a database rule; a clash
        # is turned into a message by the box for the day, in save_with_record().
        validators = []

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        branch = self.context.get("branch")
        # Only this branch's ministers can be chosen.
        if branch is not None:
            self.fields["minister"].queryset = Minister.objects.filter(branch=branch)

    def get_source_titles(self, obj):
        return [document.title for document in obj.source_documents.all()]

    def get_reviewed_by_name(self, obj):
        person = obj.reviewed_by
        if person is None:
            return ""
        return person.get_full_name() or person.username


class StaffMessageViewSet(BranchContentViewSet):
    queryset = DailyMessage.objects.select_related("minister", "reviewed_by").prefetch_related("source_documents").order_by("-date", "-created_at", "-pk")
    serializer_class = StaffMessageSerializer

    def get_queryset(self):
        return self.queryset.filter(minister__branch=self.branch)

    def save_with_record(self, serializer):
        # Publishing records who did it and when; unpublishing clears that again.
        instance = serializer.instance
        status = serializer.validated_data.get("status", getattr(instance, "status", "pending_review"))
        record = {}
        if status == "published":
            if instance is None or instance.status != "published":
                record = {"reviewed_by": self.request.user, "published_at": timezone.now()}
        else:
            record = {"reviewed_by": None, "published_at": None}
        try:
            with transaction.atomic():
                serializer.save(**record)
        except IntegrityError:
            # The minister and day are checked against existing rows, so this is
            # the one published message per minister per day rule.
            raise serializers.ValidationError({"date": [SAME_DAY]})

    def perform_create(self, serializer):
        self.save_with_record(serializer)

    def perform_update(self, serializer):
        self.save_with_record(serializer)
