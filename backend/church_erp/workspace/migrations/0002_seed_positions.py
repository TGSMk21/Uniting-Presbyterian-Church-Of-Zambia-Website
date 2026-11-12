"""The starting offices (decision D8.3). More are added in the dashboard."""
from django.db import migrations

POSITIONS = [
    ("branch", "Session Clerk", True, 1),
    ("branch", "Treasurer", False, 2),
    ("presbytery", "Moderator", True, 1),
    ("presbytery", "Clerk", True, 2),
    ("presbytery", "Treasurer", False, 3),
    ("synod", "Moderator", True, 1),
    ("synod", "Clerk", True, 2),
    ("synod", "Treasurer", False, 3),
]


def add(apps, schema_editor):
    Position = apps.get_model("workspace", "Position")
    for level, name, organises, order in POSITIONS:
        Position.objects.get_or_create(level=level, name=name, defaults={"can_organise": organises, "order": order})


class Migration(migrations.Migration):
    dependencies = [("workspace", "0001_initial")]
    operations = [migrations.RunPython(add, migrations.RunPython.noop)]
