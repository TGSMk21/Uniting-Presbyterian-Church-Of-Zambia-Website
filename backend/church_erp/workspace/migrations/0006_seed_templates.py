"""The routine meetings' usual deliverables (Task 8.4). Edited later in the dashboard."""
from django.db import migrations

# (template, level, [(title, position name or "minister", days before)])
TEMPLATES = [
    ("Session meeting", "branch", [
        ("Minutes of the last meeting", "Session Clerk", 3),
        ("Financial report", "Treasurer", 3),
        ("Minister's report", "minister", 2),
    ]),
    ("Presbytery meeting", "presbytery", [
        ("Minutes of the last meeting", "Clerk", 7),
        ("Treasurer's report", "Treasurer", 7),
        ("Moderator's report", "Moderator", 5),
    ]),
    ("Synod meeting", "synod", [
        ("Minutes of the last meeting", "Clerk", 14),
        ("Treasurer's report", "Treasurer", 14),
        ("Moderator's report", "Moderator", 10),
    ]),
]


def add(apps, schema_editor):
    Position = apps.get_model("workspace", "Position")
    MeetingTemplate = apps.get_model("workspace", "MeetingTemplate")
    TemplateItem = apps.get_model("workspace", "TemplateItem")
    for order, (name, level, items) in enumerate(TEMPLATES, start=1):
        template, created = MeetingTemplate.objects.get_or_create(level=level, name=name, defaults={"order": order})
        if not created:
            continue
        for index, (title, who, days) in enumerate(items, start=1):
            position = None if who == "minister" else Position.objects.filter(level=level, name=who).first()
            TemplateItem.objects.create(template=template, title=title, position=position,
                                        for_minister=who == "minister", days_before=days, order=index)


class Migration(migrations.Migration):
    dependencies = [("workspace", "0005_deliverables_templates")]
    operations = [migrations.RunPython(add, migrations.RunPython.noop)]
