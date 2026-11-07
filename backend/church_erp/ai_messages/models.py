from django.conf import settings
from django.db import models
from pgvector.django import VectorField

from church_erp.core.models import Minister
from church_erp.media_library.models import private_storage

EMBEDDING_DIMENSIONS = 1536


class SermonDocument(models.Model):
    """A pastor's written sermon (AGENT_EXECUTION_PLAN.md, Task 4.1).

    Private: only its branch's staff see it, through its minister. It feeds the
    daily message drafts, and is never shown on the website."""
    minister = models.ForeignKey(Minister, on_delete=models.CASCADE, related_name='sermon_documents')
    title = models.CharField(max_length=300)
    preached_on = models.DateField(null=True, blank=True)
    text = models.TextField()
    # The file it was read from, if any, kept in the private bucket under a name we choose.
    source_file = models.FileField(upload_to='sermon_documents/', storage=private_storage, blank=True)
    source_name = models.CharField(max_length=255, blank=True, help_text="The file's name on the pastor's computer")
    file_kind = models.CharField(max_length=10, blank=True)
    uploaded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='+')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-preached_on', '-created_at']

    def __str__(self):
        return self.title


class SermonEmbedding(models.Model):
    """One passage of a written sermon, with its position in meaning-space (Task 4.2).

    `model` names the embedding model that made it: vectors from different
    models can't be compared, so a change of model means reading every sermon again."""
    document = models.ForeignKey(SermonDocument, on_delete=models.CASCADE, related_name='embeddings')
    chunk_index = models.PositiveIntegerField()
    chunk_text = models.TextField()
    embedding = VectorField(dimensions=EMBEDDING_DIMENSIONS)
    model = models.CharField(max_length=100)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['document', 'chunk_index']
        constraints = [
            models.UniqueConstraint(fields=['document', 'chunk_index'], name='one_embedding_per_chunk'),
        ]

    def __str__(self):
        return f"{self.document} #{self.chunk_index}"


class DailyMessage(models.Model):
    minister = models.ForeignKey(Minister, on_delete=models.CASCADE, related_name='daily_messages')
    title = models.CharField(max_length=300)
    message = models.TextField()
    reference_verse = models.CharField(max_length=100, blank=True)
    verse_text = models.TextField(blank=True, help_text="Today's scripture, shown above the devotion")
    date = models.DateField()
    status = models.CharField(max_length=20, choices=[
        ('pending_review', 'Pending Review'),
        ('published', 'Published'),
        ('rejected', 'Rejected'),
    ], default='pending_review')
    # Drafts written by the AI from the minister's sermons (Task 4.3); staff check them before publishing.
    ai_generated = models.BooleanField(default=False)
    source_documents = models.ManyToManyField(
        SermonDocument, blank=True, related_name='daily_messages',
        help_text="Written sermons the draft was based on",
    )
    reviewed_by = models.ForeignKey('accounts.User', on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    published_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-date']
        constraints = [
            # A minister's day has one published message; drafts can pile up.
            models.UniqueConstraint(
                fields=['minister', 'date'],
                condition=models.Q(status='published'),
                name='one_published_message_per_minister_day',
            ),
        ]

    def __str__(self):
        return f"{self.title} — {self.date}"
