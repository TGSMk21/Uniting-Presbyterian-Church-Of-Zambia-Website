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


class AccessRequest(models.Model):
    """Someone asking for a dashboard account (AGENT_EXECUTION_PLAN.md, Task 7.2).

    A request never makes an account by itself: a superuser (for ministers) or the
    branch's minister (for other staff) approves or turns it down."""
    KINDS = [('minister', 'Minister'), ('staff', 'Other staff')]
    STATUSES = [('waiting', 'Waiting'), ('approved', 'Approved'), ('turned_down', 'Turned down')]

    full_name = models.CharField(max_length=150)
    email = models.EmailField()
    phone = models.CharField(max_length=20)
    branch = models.ForeignKey(Branch, on_delete=models.CASCADE, related_name='access_requests')
    kind = models.CharField(max_length=10, choices=KINDS)
    note = models.TextField(blank=True)
    status = models.CharField(max_length=12, choices=STATUSES, default='waiting')
    reason = models.TextField(blank=True, help_text="Why it was turned down")
    decided_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='+')
    decided_at = models.DateTimeField(null=True, blank=True)
    account = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='+')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.full_name} ({self.get_kind_display()}, {self.branch.name})"


class PasswordLink(models.Model):
    """A single-use link for choosing a password, which lasts 72 hours (Task 7.2).

    Only a hash of the link's secret is kept, so the database can't be used to
    open it. Making a new link cancels that person's unused ones."""
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='password_links')
    token_hash = models.CharField(max_length=64, unique=True)
    made_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='+')
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    used_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"Password link for {self.user}"
