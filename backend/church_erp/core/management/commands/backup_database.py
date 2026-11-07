"""Back up the database to the private bucket now: python manage.py backup_database"""
from django.core.management.base import BaseCommand

from church_erp.core.backups import make_backup


class Command(BaseCommand):
    help = "Save today's database backup to the private bucket and keep the newest 30. Safe to run again."

    def handle(self, *args, **options):
        report = make_backup()
        self.stdout.write(f"Saved {report['file']} ({report['bytes']:,} bytes); {report['kept']} kept, {report['deleted']} deleted.")
