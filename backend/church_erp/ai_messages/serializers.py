from rest_framework import serializers

from .models import SermonEmbedding, DailyMessage


class SermonEmbeddingSerializer(serializers.ModelSerializer):
    class Meta:
        model = SermonEmbedding
        fields = '__all__'


class DailyMessageSerializer(serializers.ModelSerializer):
    minister_name = serializers.CharField(source='minister.name', read_only=True)

    class Meta:
        model = DailyMessage
        fields = '__all__'
        read_only_fields = ('reviewed_by',)
