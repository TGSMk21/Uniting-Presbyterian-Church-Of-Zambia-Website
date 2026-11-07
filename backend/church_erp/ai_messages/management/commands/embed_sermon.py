"""Read written sermons for the daily messages: python manage.py embed_sermon --id 12, or --waiting."""
from django.core.management.base import BaseCommand, CommandError

from church_erp.ai_messages.embeddings import documents_to_embed, embed_document
from church_erp.ai_messages.gemini import AIUnavailable
from church_erp.ai_messages.models import SermonDocument


class Command(BaseCommand):
    help = "Cut written sermons into passages and get their embeddings from Gemini. Safe to run again."

    def add_arguments(self, parser):
        group = parser.add_mutually_exclusive_group()
        group.add_argument("--id", type=int, help="One written sermon, by its number")
        group.add_argument("--waiting", action="store_true", help="Every sermon not yet read with today's model")

    def handle(self, *args, **options):
        if options["id"] is not None:
            documents = list(SermonDocument.objects.filter(pk=options["id"]))
            if not documents:
                raise CommandError(f"There's no written sermon number {options['id']}.")
        elif options["waiting"]:
            documents = list(documents_to_embed())
        else:
            raise CommandError("Say which sermons: --id <number> or --waiting.")

        for document in documents:
            try:
                count = embed_document(document)
            except AIUnavailable as exc:
                raise CommandError(f"{document.title}: {exc}")
            self.stdout.write(f"{document.title}: {count} passage{'' if count == 1 else 's'}")
