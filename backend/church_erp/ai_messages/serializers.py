from rest_framework import serializers

from .models import SermonEmbedding, DailyMessage


class SermonEmbeddingSerializer(serializers.ModelSerializer):
    class Meta:
        model = SermonEmbedding
        fields = '__all__'


class DailyMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = DailyMessage
        fields = '__all__'
        read_only_fields = ('reviewed_by',)
