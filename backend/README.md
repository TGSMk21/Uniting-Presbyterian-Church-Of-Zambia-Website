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
- Hand the username and password over privately, not by plain email. The dashboard makes them choose a new password when they first sign in.
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

**API rate limits** are in `REST_FRAMEWORK` in `settings/base.py`: 600 requests a minute per visitor or signed-in user, and 60 writes a minute per user. Over the limit, the API answers `429`. The website builds its pages from a few shared Vercel addresses, so don't set the visitor limit below 300 a minute, or pages can be published empty. Counts are kept per server process, so the real limit is higher than the setting. In a live test, one client first got a `429` after about 2,000 requests in under a minute, so treat these limits as protection against floods, not exact quotas.

**Admin login lockout** comes from `django-axes`. Ten failed attempts lock that username, or that address, for 15 minutes, even for the right password. To unlock someone sooner, a superuser can delete the entry under **Axes → Access attempts**. Someone who knows a username can lock it for 15 minutes on purpose, which is the cost of stopping password guessing.

**Admin address.** Set `DJANGO_ADMIN_PATH` (e.g. `manage-upcz`) to move the admin away from `/admin/`, then tell staff the new address.

**Activity log.** Superusers can see who changed what under **Administration → Log entries**. Nobody can edit or delete entries there.

**Two-step login.** Superusers and branch admins must use an authenticator app, set up at their first sign-in on `/dashboard`. Others can turn it on from their account. Each person gets 10 one-time recovery codes for a lost phone. The Django admin follows the same rules, so it isn't a way around it: someone with a required role has to set it up on the dashboard before they can use the admin.

If someone loses their phone and their recovery codes, check it's really them, then a superuser can delete their devices in the admin under **TOTP devices** and **Static devices**. If that superuser is the one locked out, run this from your own machine against the production database, the same way as `createsuperuser` in step 4 of "Deploying to Render":

```bash
python manage.py reset_two_factor <username>
```

They'll set it up again at their next sign-in.

**Exporting data.** Every branch list in the admin has an **Export** button that downloads a CSV of the rows that person can see. Giving records can only be exported by finance staff and superusers.

**Dashboard sign-in** is off until `INTERNAL_API_SECRET` is set; see "Turning on the staff dashboard" below. `/api/auth/login/`, `refresh/` and `logout/` only answer the website's server, which proves itself with that secret. Everyone else gets a 404, so passwords can't be guessed against the API directly. Sign-in shares the Admin login lockout. Sessions end after 3 days without a visit. Changing a password ends every other session.

## Turning on the staff dashboard

Staff sign in at `/dashboard` on the website. It needs one shared secret, which you create once. Generate it on your own machine:

```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

Add it as `INTERNAL_API_SECRET` in both places, with the same value, then redeploy both:

1. **Render:** your service → **Environment**.
2. **Vercel:** your project → **Settings → Environment Variables**, for Production. Mark it as sensitive, and don't add a `NEXT_PUBLIC_` prefix.

Until both are set, the sign-in page says sign-in isn't available, and the public site is unaffected. To sign someone out everywhere, change their password or untick **Active** or **Staff status** on their user in the admin.

## Page wording

Staff change the wording of the website's pages at `/dashboard/pages`. Branch staff edit their own branch; superusers and National Admins edit the national site, and superusers can edit every branch.

`presbyterian-web/Utilities/pageSchema.json` lists every editable field, with today's wording as its default. `backend/church_erp/content/page_schema.json` is an identical copy, because the two deploy separately, and a test fails if they differ. To add a field, add it to both files and use it on the page. Only changes are stored (`PageContent`), so a page nobody has edited shows its defaults. In headings, `*stars*` show as italics.

Saving from the dashboard updates the public page straight away. A change to a branch's tagline, welcome text or year theme made in the Django admin can take up to an hour to show.

### Page images

Fields of type `image` in the same list are uploaded instead of typed: branch main and smaller photos and logo, and the national fellowship photos. `POST /api/page-content/<scope>/<page>/images/<key>/` uploads one and `DELETE` goes back to the original, with the same permissions as wording.

The browser shrinks photos first, because Vercel refuses requests over 4.5 MB. The API then accepts only real JPG, PNG or WebP files up to 4 MB and 25 megapixels, and saves its own WebP copy with a new name, no hidden data such as location, and its longest side limited by the field's `max_side`. Files go to the public bucket, and a replaced or removed file is deleted from it. Images can't be set through the wording API, so a saved file name always came from an upload.

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
- `accounts`: custom `User` with `branch` and `role`, and staff sign-in for the dashboard
- `content`: `Sermon`, `Project`, `Activity`, `PageContent`, `Page` (unused)
- `media_library`: `MediaAsset`, `MediaTag`
- `ai_messages`: `SermonEmbedding` (pgvector), `DailyMessage`
- `finance`: `GivingRecord`
- `api`: URL routing for all viewsets (`/api/...`)
