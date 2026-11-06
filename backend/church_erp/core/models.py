from django.db import models


class Branch(models.Model):
    name = models.CharField(max_length=200)
    slug = models.SlugField(unique=True)
    logo = models.ImageField(upload_to='branch_logos/', blank=True)
    contact_email = models.EmailField(blank=True, help_text="Receives the contact form; empty sends it to the national office")
    contact_phone = models.CharField(max_length=20, blank=True)
    address = models.TextField(blank=True)
    youtube_channel_id = models.CharField(max_length=100, blank=True)
    # Home page content
    tagline = models.CharField(max_length=200, blank=True, help_text="Hero headline, e.g. 'A place of grace, belonging & purpose.'")
    welcome_text = models.TextField(blank=True, help_text="Short welcome paragraph under the headline")
    year_theme_title = models.CharField(max_length=200, blank=True, help_text="This year's church theme")
    year_theme_text = models.TextField(blank=True)
    hero_image = models.ImageField(upload_to='branch_hero/', blank=True)
    hero_image_secondary = models.ImageField(upload_to='branch_hero/', blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name_plural = "branches"
        ordering = ['name']

    def __str__(self):
        return self.name


class Minister(models.Model):
    branch = models.ForeignKey(Branch, on_delete=models.CASCADE, related_name='ministers')
    name = models.CharField(max_length=200)
    bio = models.TextField(blank=True)
    photo = models.ImageField(upload_to='ministers/', blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return f"{self.name} — {self.branch.name}"


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
