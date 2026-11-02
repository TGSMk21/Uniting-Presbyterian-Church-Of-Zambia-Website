from rest_framework import serializers

from .models import GivingRecord


class GivingRecordSerializer(serializers.ModelSerializer):
    class Meta:
        model = GivingRecord
        fields = '__all__'
