from django.db import models
from church_erp.core.models import Branch
from church_erp.accounts.models import User


class MediaTag(models.Model):
    name = models.CharField(max_length=100, unique=True)

    def __str__(self):
        return self.name


class MediaAsset(models.Model):
    branch = models.ForeignKey(Branch, on_delete=models.CASCADE, related_name='media_assets')
    file = models.FileField(upload_to='media_library/%Y/%m/')
    file_type = models.CharField(max_length=20, choices=[
        ('image', 'Image'), ('video', 'Video'), ('audio', 'Audio'), ('document', 'Document')
    ])
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    tags = models.ManyToManyField(MediaTag, blank=True)
    uploaded_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-uploaded_at']

    def __str__(self):
        return self.title
