from rest_framework import serializers

from .models import Branch, Minister


class BranchSerializer(serializers.ModelSerializer):
    class Meta:
        model = Branch
        fields = '__all__'


class MinisterSerializer(serializers.ModelSerializer):
    class Meta:
        model = Minister
        fields = '__all__'
