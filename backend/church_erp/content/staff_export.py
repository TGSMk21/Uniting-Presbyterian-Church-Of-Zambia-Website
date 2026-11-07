"""CSV files of a branch's rows, for the dashboard (AGENT_EXECUTION_PLAN.md, Task 5.3)."""
import csv

from django.http import HttpResponse
from django.utils import timezone

# Enough for any one branch's section; a guard against an accidental huge file.
EXPORT_LIMIT = 10000
# A cell starting with one of these is run as a formula by spreadsheet programs.
FORMULA_STARTS = ("=", "+", "-", "@", "\t", "\r")


def heading(name, field):
    if field.label:
        return str(field.label)
    return "ID" if name == "id" else name.replace("_", " ").capitalize()


def cell(value):
    if value is None:
        return ""
    if isinstance(value, bool):
        return "Yes" if value else "No"
    if isinstance(value, (list, tuple)):
        value = ", ".join(str(item) for item in value)
    text = str(value)
    # Shown as typed rather than run, so a cell can't fetch or change anything.
    return "'" + text if text.startswith(FORMULA_STARTS) else text


def csv_response(rows, fields, filename):
    """`rows` are serializer outputs; `fields` maps each name to its serializer field."""
    response = HttpResponse(content_type="text/csv; charset=utf-8")
    response["Content-Disposition"] = f'attachment; filename="{filename}"'
    response["Cache-Control"] = "no-store"
    # Excel needs this marker to read the file as UTF-8.
    response.write("\ufeff")
    writer = csv.writer(response)
    writer.writerow([heading(name, field) for name, field in fields.items()])
    for row in rows:
        writer.writerow([cell(row.get(name)) for name in fields])
    return response


def export_filename(branch, section):
    return f"{branch.slug}-{section}-{timezone.localdate().isoformat()}.csv"
