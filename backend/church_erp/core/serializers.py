from rest_framework import serializers

from .models import Branch, Minister, ServiceTime


class ServiceTimeSerializer(serializers.ModelSerializer):
    class Meta:
        model = ServiceTime
        exclude = ('branch',)


class BranchSerializer(serializers.ModelSerializer):
    service_times = ServiceTimeSerializer(many=True, read_only=True)

    class Meta:
        model = Branch
        fields = '__all__'


class MinisterSerializer(serializers.ModelSerializer):
    class Meta:
        model = Minister
        fields = '__all__'
