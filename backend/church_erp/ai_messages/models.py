from django.db import models
from church_erp.core.models import Minister
from church_erp.content.models import Sermon
from pgvector.django import VectorField


class SermonEmbedding(models.Model):
    sermon = models.OneToOneField(Sermon, on_delete=models.CASCADE, related_name='embedding')
    chunk_index = models.IntegerField()
    chunk_text = models.TextField()
    embedding = VectorField(dimensions=1536)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=['sermon', 'chunk_index']),
        ]


class DailyMessage(models.Model):
    minister = models.ForeignKey(Minister, on_delete=models.CASCADE, related_name='daily_messages')
    title = models.CharField(max_length=300)
    message = models.TextField()
    reference_verse = models.CharField(max_length=100, blank=True)
    date = models.DateField()
    status = models.CharField(max_length=20, choices=[
        ('pending_review', 'Pending Review'),
        ('published', 'Published'),
        ('rejected', 'Rejected'),
    ], default='pending_review')
    source_sermons = models.ManyToManyField(Sermon, blank=True, help_text="Sermons used as context for generation")
    reviewed_by = models.ForeignKey('accounts.User', on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    published_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-date']

    def __str__(self):
        return f"{self.title} — {self.date}"
