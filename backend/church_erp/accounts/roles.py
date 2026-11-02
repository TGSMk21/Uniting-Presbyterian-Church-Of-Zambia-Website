"""A staff user's `role` decides which permission group they're in."""
import logging

from django.contrib.auth.models import Group

logger = logging.getLogger(__name__)

# Group names are created by `manage.py setup_roles`. National admins
# (role 'super_admin') should be superusers and get no group.
ROLE_GROUP_NAMES = {
    'content_editor': 'Content Editor',
    'branch_admin': 'Branch Admin',
    'finance_admin': 'Finance Admin',
}


def sync_role_group(user):
    """Put `user` in their role's group and out of the other role groups.
    Groups unrelated to roles are left alone."""
    role_groups = {g.name: g for g in Group.objects.filter(name__in=ROLE_GROUP_NAMES.values())}
    wanted = ROLE_GROUP_NAMES.get(user.role)
    user.groups.remove(*[g for name, g in role_groups.items() if name != wanted])
    if not wanted:
        return
    if wanted in role_groups:
        user.groups.add(role_groups[wanted])
    else:
        logger.warning("Group %r does not exist yet; run `manage.py setup_roles`.", wanted)
