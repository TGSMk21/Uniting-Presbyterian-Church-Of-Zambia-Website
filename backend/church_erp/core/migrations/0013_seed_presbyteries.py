"""The Synod of Zambia's presbyteries, from the UPCSA's 2026 Executive Commission
papers (AGENT_EXECUTION_PLAN.md, 8.0). Superusers can rename or add them later."""
from django.db import migrations

PRESBYTERIES = [("Copperbelt", "copperbelt"), ("Eastern Zambia", "eastern-zambia"), ("M'chinga", "mchinga"), ("Munali", "munali")]


def add(apps, schema_editor):
    Presbytery = apps.get_model("core", "Presbytery")
    for order, (name, slug) in enumerate(PRESBYTERIES, start=1):
        Presbytery.objects.get_or_create(slug=slug, defaults={"name": name, "order": order})


class Migration(migrations.Migration):
    dependencies = [("core", "0012_presbytery_branch_presbytery")]
    operations = [migrations.RunPython(add, migrations.RunPython.noop)]
