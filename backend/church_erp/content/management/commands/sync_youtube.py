from django.core.management.base import BaseCommand, CommandError

from church_erp.content.youtube_sync import sync_branch
from church_erp.core.models import Branch


class Command(BaseCommand):
    help = "Import YouTube uploads as sermons and refresh live status. Safe to re-run."

    def add_arguments(self, parser):
        parser.add_argument("--branch", help="Branch slug (default: every active branch with a channel)")

    def handle(self, *args, **options):
        branches = Branch.objects.filter(is_active=True).exclude(youtube_channel_id="")
        if options["branch"]:
            branches = branches.filter(slug=options["branch"])
            if not branches.exists():
                raise CommandError(f"No active branch {options['branch']!r} with a YouTube channel.")
        for branch in branches:
            result = sync_branch(branch)
            if result.error:
                self.stderr.write(f"{branch.slug}: {result.error}")
            else:
                self.stdout.write(self.style.SUCCESS(
                    f"{branch.slug}: {result.created} new, {result.live} live"
                ))
