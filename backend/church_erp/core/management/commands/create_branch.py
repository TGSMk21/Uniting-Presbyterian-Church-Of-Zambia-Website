import secrets

from django.core.exceptions import ValidationError
from django.core.management.base import BaseCommand, CommandError
from django.core.validators import validate_email, validate_slug
from django.db import transaction

from church_erp.accounts.models import User
from church_erp.core.models import Branch


class Command(BaseCommand):
    help = (
        "Onboard a branch: create it plus one branch-admin login, and print "
        "the admin's temporary password. Run `setup_roles` first."
    )

    def add_arguments(self, parser):
        parser.add_argument("--name", required=True)
        parser.add_argument("--slug", required=True, help="URL name, e.g. 'kabwe' for /kabwe")
        parser.add_argument("--contact-email", required=True, help="Receives the branch's contact form")
        parser.add_argument("--youtube-channel-id", default="", help="Channel ID starting with UC")
        parser.add_argument("--phone", default="")
        parser.add_argument("--address", default="")
        parser.add_argument("--admin-username", help="Default: <slug>-admin")
        parser.add_argument("--admin-email", help="Default: the contact email")

    def handle(self, *args, **opts):
        slug = opts["slug"]
        username = opts["admin_username"] or f"{slug}-admin"
        try:
            validate_slug(slug)
            validate_email(opts["contact_email"])
            if opts["admin_email"]:
                validate_email(opts["admin_email"])
        except ValidationError as exc:
            raise CommandError(" ".join(exc.messages))
        channel = opts["youtube_channel_id"]
        if channel and not channel.startswith("UC"):
            raise CommandError(f"YouTube channel IDs start with 'UC'; got {channel!r}.")
        if Branch.objects.filter(slug=slug).exists():
            raise CommandError(f"A branch with slug '{slug}' already exists.")
        if User.objects.filter(username=username).exists():
            raise CommandError(f"A user named '{username}' already exists; pass --admin-username.")

        password = secrets.token_urlsafe(16)
        with transaction.atomic():
            branch = Branch.objects.create(
                name=opts["name"],
                slug=slug,
                contact_email=opts["contact_email"],
                contact_phone=opts["phone"],
                address=opts["address"],
                youtube_channel_id=channel,
            )
            User.objects.create_user(
                username=username,
                email=opts["admin_email"] or opts["contact_email"],
                password=password,
                branch=branch,
                role="branch_admin",
                is_staff=True,
            )

        self.stdout.write(self.style.SUCCESS(f"Created branch '{branch.name}' at /{slug}"))
        self.stdout.write(f"Admin username: {username}")
        self.stdout.write(f"Temporary password: {password}")
        self.stdout.write(
            "Give these to the branch admin privately (not by plain email), and ask them "
            "to change the password at /admin/password_change/ after first login."
        )
