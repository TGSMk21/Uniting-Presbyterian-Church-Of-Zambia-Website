from django.contrib.auth.models import AbstractUser
from django.db import models

from church_erp.core.models import Branch


class User(AbstractUser):
    branch = models.ForeignKey(
        Branch, on_delete=models.SET_NULL, null=True,
        blank=True, related_name='staff'
    )
    role = models.CharField(max_length=20, choices=[
        ('super_admin', 'National Admin'),
        ('branch_admin', 'Branch Admin'),
        ('finance_admin', 'Finance Admin'),
        ('content_editor', 'Content Editor'),
    ], default='content_editor')
    must_change_password = models.BooleanField(
        default=False,
        help_text="Ask this person to choose a new password when they next sign in to the dashboard.",
    )

    class Meta:
        verbose_name = "user"
        verbose_name_plural = "users"

    def __str__(self):
        return f"{self.get_full_name() or self.username} ({self.get_role_display()})"
