from rest_framework import serializers

from .models import Activity, Announcement, Hymn, Project, Sermon


class SermonSerializer(serializers.ModelSerializer):
    class Meta:
        model = Sermon
        exclude = ['is_hidden']


class PhotoSerializer(serializers.Serializer):
    """A project's or activity's photo: its id and full address."""
    id = serializers.IntegerField(read_only=True)
    url = serializers.ImageField(source='image', read_only=True)


class ProjectSerializer(serializers.ModelSerializer):
    photos = PhotoSerializer(many=True, read_only=True)

    class Meta:
        model = Project
        fields = '__all__'


class AnnouncementSerializer(serializers.ModelSerializer):
    """What the public sees of an announcement."""

    class Meta:
        model = Announcement
        fields = ['id', 'title', 'body', 'starts_on', 'ends_on', 'is_pinned']


class ActivitySerializer(serializers.ModelSerializer):
    branch_name = serializers.CharField(source='branch.name', read_only=True)
    branch_slug = serializers.CharField(source='branch.slug', read_only=True)
    photos = PhotoSerializer(many=True, read_only=True)

    class Meta:
        model = Activity
        fields = '__all__'



class HymnSerializer(serializers.ModelSerializer):
    """One hymn, full text (the app downloads a whole collection for offline use)."""
    class Meta:
        model = Hymn
        fields = ["id", "collection", "number", "title", "verses", "chorus", "notes", "updated_at"]

    def validate_collection(self, value):
        valid = {choice for choice, _label in Hymn.COLLECTIONS}
        if value not in valid:
            raise serializers.ValidationError(f"Choose one of: {', '.join(sorted(valid))}")
        return value

    def validate_number(self, value):
        if value < 1:
            raise serializers.ValidationError("The hymn number must be 1 or more.")
        return value

    def validate_title(self, value):
        if not value.strip():
            raise serializers.ValidationError("Give the hymn a title.")
        return value.strip()

    def validate_verses(self, value):
        if not isinstance(value, list) or not all(isinstance(v, str) for v in value):
            raise serializers.ValidationError("Verses must be a list of texts.")
        return [v for v in (verse.strip() for verse in value) if v]
