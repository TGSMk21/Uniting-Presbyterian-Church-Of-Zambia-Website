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

## Main branches and the church locator

`python manage.py seed_upcsa_branches` adds the main branches with placeholder details and approximate map pins. It's safe to re-run and never overwrites details entered later. To place a church exactly on the national "Find a Branch" map, set **Latitude** and **Longitude** on its branch in the admin and tick **Location confirmed**.

## Onboarding a branch

One command creates the branch and its first branch-admin login, and prints a temporary password:

```bash
python manage.py create_branch --name "Kabwe Presbyterian Church" --slug kabwe --contact-email kabwe@example.org --youtube-channel-id UCxxxxxxxxxxxxxxxxxxxxxx --phone "0977 000 000" --address "Kabwe"
```

- The site appears at `/<slug>`, and the national directory lists it automatically.
- The login is `<slug>-admin` by default (change it with `--admin-username` / `--admin-email`). It has the Branch Admin role, so it sees and edits only this branch.
- Hand the username and password over privately, not by plain email, and ask the admin to change the password after first login (`/admin/password_change/`).
- Then, in the admin, add the branch's minister(s), service times, home-page text, projects and activities. Run `sync_youtube --branch <slug>` to import its sermons.

On Render's free plan there is no shell, so run it from your own machine against the production database, the same way as `createsuperuser` in step 4 of "Deploying to Render" below.

## Deploying to Render

`render.yaml` at the repository root is a Render Blueprint for this backend on Render's **free** plan. The frontend goes on Vercel.

1. **Database URL.** In Supabase, open **Connect** and copy the **Session pooler** connection string (port 5432). Render can't reach Supabase's direct connection, which is IPv6-only. Put your database password into the string.
2. **Create the service.** In Render, choose **New → Blueprint**, connect this GitHub repository, and enter the three values it asks for:
   - `DATABASE_URL`: the string from step 1.
   - `YOUTUBE_API_KEY`: the key the old frontend used.
   - `FRONTEND_URL`: your Vercel URL. If you don't have it yet, enter `https://example.com` and update it after deploying the frontend.

   Render generates `DJANGO_SECRET_KEY` and `SYNC_TOKEN` itself.
3. **First deploy.** Render installs, collects static files, then runs `migrate` and `setup_roles` on start, so there are no one-off commands to run. When it's live, `https://<service>.onrender.com/api/branches/` should return JSON.
4. **Superuser.** The free plan has no shell, so create it from your own machine against the same database:

   ```bash
   DJANGO_SETTINGS_MODULE=church_erp.settings.production DJANGO_SECRET_KEY=temp-not-used-for-users-0123456789abcdefghijklmnop DJANGO_ALLOWED_HOSTS=localhost FRONTEND_URL=http://localhost DATABASE_URL="<session pooler string>" python manage.py createsuperuser
   ```

   Run any other management command the same way, e.g. `sync_youtube`.
5. **Schedule the YouTube sync.** The free plan has no cron jobs and sleeps after 15 minutes without traffic. Create a free job at [cron-job.org](https://cron-job.org):
   - URL: `https://<service>.onrender.com/api/tasks/sync-youtube/`
   - Method: **POST**
   - Header: `X-Sync-Token` set to the `SYNC_TOKEN` value from the Render dashboard (Environment tab)
   - Schedule: every **10 minutes**

   This runs the sync and keeps the service awake. One always-awake service uses about 744 of Render's 750 free hours a month, so don't add a second free service to the same workspace.
6. **Point the backend at the frontend.** After the Vercel deploy, set `FRONTEND_URL` to the real site URL(s), comma-separated, and redeploy.

If the site later moves to a paid Render plan, replace step 5 with a Render cron job running `python manage.py sync_youtube`, and move `migrate`/`setup_roles` into a pre-deploy command.

## Storing uploads (Cloudflare R2)

Render's disk is wiped on every deploy, so production uploads go to Cloudflare R2. There are two buckets because R2 makes a bucket public as a whole:

| Bucket | Holds | Links |
|---|---|---|
| public (e.g. `upcz-public`) | branch logos and hero images, minister photos | plain links on the bucket's public domain |
| private (e.g. `upcz-private`) | media-library files (photos, documents) | signed links that expire after 1 hour |

1. In the Cloudflare dashboard, open **R2** and create the two buckets.
2. Make **only the public bucket** public: open it → **Settings** → **Public access**. Either connect a custom domain (e.g. `media.yourdomain.org`, recommended) or enable the `r2.dev` subdomain (fine to start with, but rate-limited). Leave the private bucket private.
3. Create an API token: **R2 → Manage API tokens → Create API token**, with **Object Read & Write** permission for both buckets. Copy the Access Key ID and Secret Access Key. The secret is shown only once.
4. In Render → your service → **Environment**, add:

   | Key | Value |
   |---|---|
   | `AWS_STORAGE_BUCKET_NAME` | the public bucket's name |
   | `AWS_PRIVATE_BUCKET_NAME` | the private bucket's name |
   | `MEDIA_PUBLIC_DOMAIN` | the public bucket's domain, without `https://` (e.g. `pub-xxxx.r2.dev`) |
   | `AWS_S3_ENDPOINT_URL` | `https://<account-id>.r2.cloudflarestorage.com` (shown on the bucket's settings page) |
   | `AWS_ACCESS_KEY_ID` | from step 3 |
   | `AWS_SECRET_ACCESS_KEY` | from step 3 |

   Save and redeploy. If any of these is missing once `AWS_STORAGE_BUCKET_NAME` is set, the backend refuses to start and names the missing one. Without `AWS_STORAGE_BUCKET_NAME`, uploads stay on Render's disk and vanish on the next deploy.
5. Check: upload a hero image on a branch in the admin, open the branch's page, and confirm the image URL starts with your public domain.

The tests check all of this against an in-process fake S3 (`moto`, in `requirements-dev.txt`).

## Security

**API rate limits** are in `REST_FRAMEWORK` in `settings/base.py`: 600 requests a minute per visitor or signed-in user, and 60 writes a minute per user. Over the limit, the API answers `429`. The website builds its pages from a few shared Vercel addresses, so don't set the visitor limit below 300 a minute, or pages can be published empty. Counts are kept per server process, so with two workers the real limit can be up to double.

**Admin login lockout** comes from `django-axes`. Ten failed attempts lock that username, or that address, for 15 minutes, even for the right password. To unlock someone sooner, a superuser can delete the entry under **Axes → Access attempts**. Someone who knows a username can lock it for 15 minutes on purpose, which is the cost of stopping password guessing.

**Admin address.** Set `DJANGO_ADMIN_PATH` (e.g. `manage-upcz`) to move the admin away from `/admin/`, then tell staff the new address.

**Activity log.** Superusers can see who changed what under **Administration → Log entries**. Nobody can edit or delete entries there.

**Exporting data.** Every branch list in the admin has an **Export** button that downloads a CSV of the rows that person can see. Giving records can only be exported by finance staff and superusers.

**API sign-in.** There's no `/api/auth/` route: nothing uses it, and it would be a way to guess passwords. Add it back with token rotation when an app needs to write through the API.

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
