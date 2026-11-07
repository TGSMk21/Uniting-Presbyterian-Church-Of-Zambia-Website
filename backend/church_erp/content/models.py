from django.conf import settings
from django.db import models
from church_erp.core.models import Branch, Minister


class Sermon(models.Model):
    branch = models.ForeignKey(Branch, on_delete=models.CASCADE, related_name='sermons')
    minister = models.ForeignKey(Minister, on_delete=models.SET_NULL, null=True, blank=True, related_name='sermons')
    title = models.CharField(max_length=300)
    series = models.CharField(max_length=200, blank=True)
    description = models.TextField(blank=True)
    video_id = models.CharField("YouTube Video ID", max_length=50, blank=True)
    duration = models.CharField(max_length=20, blank=True, help_text="ISO 8601, set by the YouTube sync")
    transcript = models.TextField(blank=True, help_text="Full sermon text for embedding/search")
    reference_verse = models.CharField(max_length=100, blank=True)
    preached_at = models.DateTimeField()
    is_live = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-preached_at']
        constraints = [
            models.UniqueConstraint(
                fields=['branch', 'video_id'],
                condition=~models.Q(video_id=''),
                name='unique_video_per_branch',
            ),
        ]

    def __str__(self):
        return self.title


class Project(models.Model):
    branch = models.ForeignKey(Branch, on_delete=models.CASCADE, related_name='projects')
    title = models.CharField(max_length=300)
    status = models.CharField(max_length=20, choices=[
        ('ONGOING', 'Ongoing'), ('COMPLETED', 'Completed'), ('PENDING', 'Pending')
    ], default='PENDING')
    description = models.TextField()
    start_date = models.DateField()
    end_date = models.DateField(null=True, blank=True)
    progress = models.IntegerField(default=0, help_text="Percentage 0-100")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.title


class Activity(models.Model):
    branch = models.ForeignKey(Branch, on_delete=models.CASCADE, related_name='activities')
    title = models.CharField(max_length=300)
    start_time = models.TimeField()
    end_time = models.TimeField()
    date = models.DateField()
    details = models.TextField()
    location = models.CharField(max_length=300)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name_plural = "activities"
        ordering = ['date']

    def __str__(self):
        return self.title


class PageContent(models.Model):
    """Changed wording for one page; see page_content.py. No branch means the national site."""
    branch = models.ForeignKey(Branch, on_delete=models.CASCADE, null=True, blank=True, related_name='page_content')
    page = models.CharField(max_length=50)
    fields = models.JSONField(default=dict)
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='+',
    )
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name_plural = "page content"
        constraints = [
            models.UniqueConstraint(
                fields=['branch', 'page'], condition=models.Q(branch__isnull=False), name='unique_page_per_branch',
            ),
            models.UniqueConstraint(
                fields=['page'], condition=models.Q(branch__isnull=True), name='unique_national_page',
            ),
        ]

    def __str__(self):
        return f"{self.branch or 'National'}: {self.page}"


class Page(models.Model):
    """Flexible page content — about pages, custom pages per branch."""
    branch = models.ForeignKey(Branch, on_delete=models.CASCADE, related_name='pages')
    slug = models.SlugField()
    title = models.CharField(max_length=200)
    content = models.TextField(blank=True, help_text="HTML or plain text content")
    is_published = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = [('branch', 'slug')]

    def __str__(self):
        return f"{self.title} ({self.branch.name})"
