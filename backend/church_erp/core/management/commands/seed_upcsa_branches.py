from decimal import Decimal

from django.core.management.base import BaseCommand

from church_erp.core.models import Branch

# The main branches, as given by the project owner. Contact details stay empty
# until each branch supplies them, never invented. Coordinates are the centre
# of the area on OpenStreetMap, so `location_confirmed` stays False until a
# branch's exact position is entered in the admin.
BRANCHES = [
    # slug, name, address, latitude, longitude
    ("chilanga", "Chilanga Presbyterian Church", "Chilanga, Zambia", "-15.5588", "28.2755"),
    ("kanyama", "Kanyama Presbyterian Church", "Lusaka, Zambia", "-15.4364", "28.2368"),
    ("st-columbus-kabwe", "St Columbus Presbyterian Church, Kabwe", "Kabwe, Zambia", "-14.4434", "28.4465"),
    ("david-livingstone-memorial", "David Livingstone Memorial Presbyterian Church",
     "Livingstone, Zambia", "-17.8531", "25.8614"),
    ("chawama", "Chawama Presbyterian Church", "Lusaka, Zambia", "-15.4590", "28.2826"),
    ("matero", "Matero Presbyterian Church", "Lusaka, Zambia", "-15.3822", "28.2621"),
    ("kabwata", "Kabwata Presbyterian Church", "Lusaka, Zambia", "-15.4333", "28.3071"),
    ("kaunda-square", "Kaunda Square Presbyterian Church", "Lusaka, Zambia", "-15.3747", "28.3562"),
    ("kabanana", "Kabanana Presbyterian Church", "Lusaka, Zambia", "-15.3520", "28.3083"),
    ("misisi", "Misisi Presbyterian Church", "Lusaka, Zambia", "-15.4380", "28.2818"),
]


class Command(BaseCommand):
    help = (
        "Add the main branches with placeholder details. Safe to re-run: existing "
        "branches keep their details and only gain a map location if they have none."
    )

    def handle(self, *args, **options):
        created = 0
        for slug, name, address, latitude, longitude in BRANCHES:
            location = {"latitude": Decimal(latitude), "longitude": Decimal(longitude)}
            branch, was_created = Branch.objects.get_or_create(
                slug=slug, defaults={"name": name, "address": address, **location}
            )
            created += was_created
            if branch.latitude is None or branch.longitude is None:
                Branch.objects.filter(pk=branch.pk).update(**location)
        self.stdout.write(self.style.SUCCESS(
            f"{created} created, {len(BRANCHES) - created} already existed"
        ))
