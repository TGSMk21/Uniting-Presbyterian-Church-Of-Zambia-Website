from rest_framework import serializers

from .models import DailyMessage


class DailyMessageSerializer(serializers.ModelSerializer):
    """What the public sees. Who published it stays in the dashboard."""
    minister_name = serializers.CharField(source='minister.name', read_only=True)

    class Meta:
        model = DailyMessage
        fields = [
            'id', 'minister', 'minister_name', 'title', 'message',
            'reference_verse', 'verse_text', 'date', 'published_at',
        ]
