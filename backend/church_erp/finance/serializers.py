from rest_framework import serializers

from .models import GivingRecord


class GivingRecordSerializer(serializers.ModelSerializer):
    class Meta:
        model = GivingRecord
        fields = '__all__'
        read_only_fields = ('recorded_by',)
