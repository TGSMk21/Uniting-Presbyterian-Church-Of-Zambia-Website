# UPCZ Church Platform — Backend

Django + Django REST Framework API and admin for the Uniting Presbyterian Church in Zambia's branch websites. The Next.js frontend in `../presbyterian-web/` reads from this API.

## Local setup

Requires Python 3.12+ and a PostgreSQL database. Run these from `backend/`.

```bash
python -m venv .venv
```

Activate the virtual environment (Windows Git Bash: `source .venv/Scripts/activate`; macOS/Linux: `source .venv/bin/activate`), then install dependencies. `requirements-dev.txt` adds optional dev tools on top of `requirements.txt`:

```bash
pip install -r requirements-dev.txt
```

Copy the environment template and fill in at least `DJANGO_SECRET_KEY` and the `DB_*` values:

```bash
cp .env.example .env
```

Create the tables, the admin permission groups and your own superuser:

```bash
python manage.py migrate
```

```bash
python manage.py setup_roles
```

```bash
python manage.py createsuperuser
```

Optionally load placeholder content (refuses to run unless `DJANGO_DEBUG=True`; its sermons link to unrelated public YouTube videos, so never use it in production):

```bash
python manage.py seed_demo
```

Start the server; the API is at http://localhost:8000/api/ and the admin at http://localhost:8000/admin/:

```bash
python manage.py runserver
```

## YouTube sermon sync

Sermons are imported from each branch's YouTube channel (`Branch.youtube_channel_id`), and `Sermon.is_live` follows YouTube's live status. It needs `YOUTUBE_API_KEY` in `.env`. Run it by hand or from cron:

```bash
python manage.py sync_youtube
```

Add `--branch <slug>` to sync a single branch. In production, Celery beat runs the same sync every 5 minutes (`CELERY_BEAT_SCHEDULE` in `settings/base.py`). Each run costs about 2 YouTube API quota units per branch. New videos are added, but titles, series and verses edited by staff are never overwritten.

## Settings

`manage.py` defaults to `church_erp.settings.local`. Production uses `DJANGO_SETTINGS_MODULE=church_erp.settings.production`.

## Tests

Tests use an in-memory SQLite database (`settings/test.py`), so they never touch the real Postgres database:

```bash
python manage.py test --settings=church_erp.settings.test
```

## Staff roles

Each staff user has a `role` and a `branch`. Run `setup_roles` once to create the permission groups. After that, a user's role decides their group automatically, and anyone added through the admin gets staff access straight away. A superuser can untick **Staff status** to suspend someone. Groups that aren't role groups are left alone.

| Role | Group | Can manage |
|---|---|---|
| `content_editor` | Content Editor | Sermons, projects, activities, pages, media, daily messages of their branch |
| `branch_admin` | Branch Admin | All of the above, plus their branch details, ministers and branch users |
| `finance_admin` | Finance Admin | Giving records of their branch (no deletes; void instead) |
| superuser | — | Everything, across all branches |

Branch scoping is enforced in both the admin (`core/admin_mixins.py`) and the API (`core/api_mixins.py`).

## Apps

- `core`: `Branch`, `Minister`
- `accounts`: custom `User` with `branch` and `role`
- `content`: `Sermon`, `Project`, `Activity`, `Page`
- `media_library`: `MediaAsset`, `MediaTag`
- `ai_messages`: `SermonEmbedding` (pgvector), `DailyMessage`
- `finance`: `GivingRecord`
- `api`: URL routing for all viewsets (`/api/...`)
