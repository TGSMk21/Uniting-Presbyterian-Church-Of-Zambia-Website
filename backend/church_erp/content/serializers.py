from rest_framework import serializers

from .models import Sermon, Project, Activity


class SermonSerializer(serializers.ModelSerializer):
    class Meta:
        model = Sermon
        exclude = ['is_hidden']


class ProjectSerializer(serializers.ModelSerializer):
    class Meta:
        model = Project
        fields = '__all__'


class ActivitySerializer(serializers.ModelSerializer):
    branch_name = serializers.CharField(source='branch.name', read_only=True)
    branch_slug = serializers.CharField(source='branch.slug', read_only=True)

    class Meta:
        model = Activity
        fields = '__all__'

