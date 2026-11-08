from rest_framework import serializers

from .models import Activity, Announcement, Project, Sermon


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

