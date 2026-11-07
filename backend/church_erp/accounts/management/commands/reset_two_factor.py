from django.core.management.base import BaseCommand, CommandError

from church_erp.accounts.models import User
from church_erp.accounts.two_factor import reset_two_factor


class Command(BaseCommand):
    help = "Turn off two-step login for someone who lost their phone and recovery codes."

    def add_arguments(self, parser):
        parser.add_argument("username")

    def handle(self, *args, **opts):
        try:
            user = User.objects.get(username=opts["username"])
        except User.DoesNotExist:
            raise CommandError(f"There's no user named '{opts['username']}'.")
        reset_two_factor(user)
        self.stdout.write(
            f"Two-step login reset for {user.username}, and their sessions ended. "
            "Check who you're helping first: they'll set it up again at their next sign-in."
        )
