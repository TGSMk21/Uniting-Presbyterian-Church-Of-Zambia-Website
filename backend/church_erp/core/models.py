from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models

from .validators import validate_not_reserved


class Presbytery(models.Model):
    """A group of branches (AGENT_EXECUTION_PLAN.md, Task 8.1). The synod is the whole church."""
    name = models.CharField(max_length=100, unique=True)
    slug = models.SlugField(unique=True)
    order = models.PositiveSmallIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name_plural = "presbyteries"
        ordering = ['order', 'name']

    def __str__(self):
        return f"{self.name} Presbytery"


class Branch(models.Model):
    name = models.CharField(max_length=200)
    slug = models.SlugField(unique=True, validators=[validate_not_reserved])
    logo = models.ImageField(upload_to='branch_logos/', blank=True)
    contact_email = models.EmailField(blank=True, help_text="Receives the contact form; empty sends it to the national office")
    contact_phone = models.CharField(max_length=20, blank=True)
    address = models.TextField(blank=True)
    youtube_channel_id = models.CharField(max_length=100, blank=True)
    # Church locator map
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    location_confirmed = models.BooleanField(
        default=False, help_text="Tick once the map position is the church itself, not just its area"
    )
    # Home page content
    tagline = models.CharField(max_length=200, blank=True, help_text="Hero headline, e.g. 'A place of grace, belonging & purpose.'")
    welcome_text = models.TextField(blank=True, help_text="Short welcome paragraph under the headline")
    year_theme_title = models.CharField(max_length=200, blank=True, help_text="This year's church theme")
    year_theme_text = models.TextField(blank=True)
    hero_image = models.ImageField(upload_to='branch_hero/', blank=True)
    hero_image_secondary = models.ImageField(upload_to='branch_hero/', blank=True)
    is_active = models.BooleanField(default=True)
    # Which presbytery it belongs to (Task 8.1); set by superusers in the dashboard.
    presbytery = models.ForeignKey(Presbytery, on_delete=models.SET_NULL, null=True, blank=True, related_name='branches')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name_plural = "branches"
        ordering = ['name']

    def __str__(self):
        return self.name


MINISTER_ROLE = "branch_admin"


def account_link_problem(account, branch_id):
    """Why `account` can't be a minister's login for `branch_id`, or None if it can (decision D1)."""
    if account is None:
        return None
    if account.is_superuser:
        return "Superusers are for the developer and can't be a minister's account."
    if account.role != MINISTER_ROLE:
        return "A minister's account must be a Branch Admin."
    if account.branch_id != branch_id:
        return "A minister's account must belong to the minister's own branch."
    return None


class Minister(models.Model):
    branch = models.ForeignKey(Branch, on_delete=models.CASCADE, related_name='ministers')
    name = models.CharField(max_length=200)
    bio = models.TextField(blank=True)
    photo = models.ImageField(upload_to='ministers/', blank=True)
    order = models.PositiveSmallIntegerField(
        default=0, help_text="Lower numbers come first. The first minister is the one on the branch's About page.",
    )
    # Daily message drafts written by the AI from their sermons (AGENT_EXECUTION_PLAN.md, Task 4.3).
    # Off until staff turn it on, so the pilot covers one minister at a time.
    ai_drafts = models.BooleanField(
        default=False, help_text="Write a draft daily message from their written sermons each day, for staff to check.",
    )
    style_notes = models.TextField(blank=True, help_text="How they like to write, for the daily message drafts")
    # The login this minister uses (AGENT_EXECUTION_PLAN.md, Task 7.1): a Branch Admin of the same branch.
    account = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='minister_profile',
        help_text="The login this minister uses. It must be a Branch Admin of the same branch.",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['order', 'name']

    def __str__(self):
        return f"{self.name} — {self.branch.name}"

    def clean(self):
        super().clean()
        problem = account_link_problem(self.account, self.branch_id)
        if problem:
            raise ValidationError({"account": problem})


class ServiceTime(models.Model):
    """A recurring service shown on the branch home page."""
    branch = models.ForeignKey(Branch, on_delete=models.CASCADE, related_name='service_times')
    day = models.CharField(max_length=50, help_text="e.g. 'Every Sunday'")
    title = models.CharField(max_length=200)
    start_time = models.TimeField()
    end_time = models.TimeField()
    location = models.CharField(max_length=200, blank=True)
    details = models.CharField(max_length=200, blank=True, help_text="e.g. 'Worship · Word · Communion'")
    order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ['order', 'start_time']

    def __str__(self):
        return f"{self.day}: {self.title}"


class StaffChange(models.Model):
    """A change made through the dashboard (AGENT_EXECUTION_PLAN.md, Task 5.4).

    Django's own history only covers the Django admin. This keeps who changed
    what, where and when; never the values themselves, which may be private."""
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+")
    # Kept as written, so the history outlives the account.
    username = models.CharField(max_length=150)
    branch = models.ForeignKey(Branch, on_delete=models.SET_NULL, null=True, blank=True, related_name="+")
    section = models.CharField(max_length=30)
    action = models.CharField(max_length=40)
    target = models.CharField(max_length=300, blank=True)
    target_id = models.CharField(max_length=40, blank=True)
    changes = models.JSONField(default=list, blank=True, help_text="Names of the fields that changed")
    at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-at", "-pk"]

    def __str__(self):
        return f"{self.username} {self.action} {self.section}: {self.target}"
