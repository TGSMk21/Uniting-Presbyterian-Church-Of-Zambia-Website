from django.contrib.auth.models import Group, Permission
from django.core.management.base import BaseCommand

from church_erp.accounts.models import User
from church_erp.accounts.roles import ROLE_GROUP_NAMES, sync_role_group

ALL = ('add', 'change', 'delete', 'view')

CONTENT_EDITOR = {
    'content': {'sermon': ALL, 'project': ALL, 'activity': ALL},
    'media_library': {'mediaasset': ALL, 'mediatag': ALL},
    'ai_messages': {'dailymessage': ('add', 'change', 'view'), 'sermonembedding': ('view',)},
}

BRANCH_ADMIN = {
    **CONTENT_EDITOR,
    'core': {'branch': ('change', 'view'), 'minister': ALL, 'servicetime': ALL},
    'accounts': {'user': ('add', 'change', 'view')},
}

FINANCE_ADMIN = {
    'finance': {'givingrecord': ('add', 'change', 'view')},
}

ROLE_GROUPS = {
    ROLE_GROUP_NAMES['content_editor']: CONTENT_EDITOR,
    ROLE_GROUP_NAMES['branch_admin']: BRANCH_ADMIN,
    ROLE_GROUP_NAMES['finance_admin']: FINANCE_ADMIN,
}


class Command(BaseCommand):
    help = "Create or reset the admin permission groups for each staff role. Safe to re-run."

    def handle(self, *args, **options):
        for name, spec in ROLE_GROUPS.items():
            group, _ = Group.objects.get_or_create(name=name)
            codenames = [
                (app, f"{action}_{model}")
                for app, models in spec.items()
                for model, actions in models.items()
                for action in actions
            ]
            permissions = [
                Permission.objects.get(content_type__app_label=app, codename=codename)
                for app, codename in codenames
            ]
            group.permissions.set(permissions)
            self.stdout.write(self.style.SUCCESS(f"{name}: {len(permissions)} permissions"))

        # Users saved before the groups existed couldn't be placed in them.
        users = User.objects.all()
        for user in users:
            sync_role_group(user)
        self.stdout.write(f"Synced role groups for {users.count()} users")
