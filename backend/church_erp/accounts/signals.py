from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import User
from .roles import sync_role_group


@receiver(post_save, sender=User)
def keep_role_group_in_sync(sender, instance, raw=False, **kwargs):
    if not raw:  # skip fixture loading
        sync_role_group(instance)
