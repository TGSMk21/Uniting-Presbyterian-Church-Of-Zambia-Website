from django.core.management.base import BaseCommand

from church_erp.core.models import Branch

# UPCSA congregations in Zambia, named on unitingpresbyterian.org: indexed "Find
# a Congregation" pages, the Jan 2025 congregation list, and the 2026 Executive
# Commission papers. Not a complete list: the official one is no longer online.
# Towns come from those listings or the suburb's location; contact details
# are left empty until each branch supplies them, never invented.
BRANCHES = [
    # Munali Presbytery
    ("chawama", "Chawama Presbyterian Church", "Lusaka, Zambia"),
    ("john-laing-cornerstone", "John Laing Cornerstone Presbyterian Church", "Lusaka, Zambia"),
    ("kabwata", "Kabwata Presbyterian Church", "Lusaka, Zambia"),
    ("mutendere", "Mutendere Presbyterian Church", "Lusaka, Zambia"),
    # M'chinga Presbytery
    ("chelstone", "Chelstone Presbyterian Church", "Lusaka, Zambia"),
    ("george", "George Presbyterian Church", "Lusaka, Zambia"),
    ("kaunda-square", "Kaunda Square Presbyterian Church", "Lusaka, Zambia"),
    ("kabanana", "Kabanana Presbyterian Church", "Lusaka, Zambia"),
    ("matero", "Matero Presbyterian Church", "Lusaka, Zambia"),
    # Copperbelt Presbytery
    ("kabushi", "Kabushi Presbyterian Church", "Ndola, Zambia"),
    ("kapoto-kwacha-east", "Kapoto/Kwacha East Presbyterian Church", "Kitwe, Zambia"),
    ("kawama", "Kawama Presbyterian Church", "Kitwe, Zambia"),
    ("kapiri-mposhi", "Kapiri Mposhi Presbyterian Church", "Kapiri Mposhi, Zambia"),
    ("kasama", "Kasama Presbyterian Church", "Kasama, Zambia"),
]


class Command(BaseCommand):
    help = (
        "Add placeholder branches for the known UPCSA congregations in Zambia. "
        "Safe to re-run: existing branches, including details entered later, are left alone."
    )

    def handle(self, *args, **options):
        created = 0
        for slug, name, address in BRANCHES:
            _, was_created = Branch.objects.get_or_create(
                slug=slug, defaults={"name": name, "address": address}
            )
            created += was_created
        self.stdout.write(self.style.SUCCESS(
            f"{created} created, {len(BRANCHES) - created} already existed"
        ))
