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
- Then its staff add ministers, service times, projects and activities, set the contact details and map position, and change the page wording, from the dashboard. Run `sync_youtube --branch <slug>` to import its sermons.

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

   This runs the sync and keeps the service awake. For the AI daily message drafts, add a second job the same way with the URL `https://<service>.onrender.com/api/tasks/daily-messages/`, every **hour** (it writes tomorrow's drafts at its first run of the day and does nothing on the others). One always-awake service uses about 744 of Render's 750 free hours a month, so don't add a second free service to the same workspace.
6. **Point the backend at the frontend.** After the Vercel deploy, set `FRONTEND_URL` to the real site URL(s), comma-separated, and redeploy.

If the site later moves to a paid Render plan, replace step 5 with a Render cron job running `python manage.py sync_youtube`, and move `migrate`/`setup_roles` into a pre-deploy command.

## Backups

Supabase's free plan keeps no backups you can restore yourself, so the site makes its own: each night, a copy of the whole database goes to the **private** R2 bucket as `backups/upcz-YYYY-MM-DD.json.gz` (the day in Zambia). The newest 30 are kept; older ones are deleted. Running it again the same day replaces that day's file. It's Django's own `dumpdata`, so Render needs no extra programs.

**Schedule it** with a third cron-job.org job, the same way as the others: `POST https://<service>.onrender.com/api/tasks/backup/` with the `X-Sync-Token` header, once a day (for example at 02:00). A failed backup answers `500`, so turn on cron-job.org's failure emails for this job. By hand: `python manage.py backup_database`.

**What's in it:** everything except what Django makes again by itself (content types, permissions, sessions, expired-token lists) and the AI's sermon passages, which the hourly daily-messages job rebuilds for any sermon that has none. Uploaded photos and files aren't in it: they're already kept in R2. The file includes password hashes and two-step login secrets, so it only ever goes to the private bucket; anyone with access to that bucket can read it.

**To restore:**
1. In Cloudflare, open R2, the private bucket, `backups/`, and download the day you want.
2. Make an empty Postgres database (a new Supabase project, or a reset of the current one) and run, on your computer with `DATABASE_URL` pointing at it:
   ```bash
   python manage.py migrate
   python manage.py loaddata upcz-YYYY-MM-DD.json.gz
   ```
   (use the same settings as `createsuperuser` in "Deploying to Render").
3. If it's a new database, set Render's `DATABASE_URL` to it and redeploy. Within the hour, the daily-messages job reads the written sermons again.

Each backup runs inside one web request (Render allows 60 seconds). That's plenty for this site's data for a long time; if the database ever grows past tens of megabytes, move to `pg_dump` on a paid plan.

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

### Sermons, projects, activities, ministers and service times

Staff manage each branch's sermons, projects, activities, ministers and service times at `/dashboard/content`, through `/api/staff/<branch>/sermons/`, `projects/`, `activities/`, `ministers/` and `services/`. Who may manage a branch follows the same rule as its pages. The public addresses (`/api/sermons/` and so on) are read-only, so every change goes through these.

Sermons are added from a YouTube link and can't be deleted, because the YouTube sync would import them again. Staff tick "Hide this sermon from the website" instead, which leaves it off the public list and its page. The sync never changes a sermon's wording or whether it's hidden; it only updates the length and the live state. The video itself can't be changed after adding. Projects and activities can be added, changed and deleted. The website clears its cached copies when staff save, so changes show straight away, including upcoming activities on the national home page.

Ministers have an order number, and the lowest is the one on the branch's About page. Their photo is uploaded at `POST /api/staff/<branch>/ministers/<id>/photo/` (`DELETE` removes it) and checked and re-saved like page images, at most 800 pixels on the longest side. A minister who has daily messages can't be deleted, because their messages would be deleted with them. Service times come with the branch, so saving one also refreshes the branch's pages and Find a Branch.

### Daily messages

Staff write their branch's daily messages at `/dashboard/content/<branch>/messages`, through `/api/staff/<branch>/messages/`. Each message comes from one of the branch's own ministers and is for one day. A new message is a draft; staff set it to Published when it's ready. Publishing records who did it and when, and unpublishing clears that again. A minister can have only one published message per day, which the database also enforces. Drafts for the same day are allowed.

The public address, `/api/daily-messages/`, is read-only. It shows only published messages whose day has come, newest day first, so a message written ahead for next Sunday appears on Sunday. The home page shows the first one. It doesn't say who published a message. AI drafts (below) arrive in the same list, marked "AI draft", for staff to check and publish.

### Written sermons and AI daily message drafts

Pastors' sermons are kept at `/dashboard/content/<branch>/writings`, through `/api/staff/<branch>/writings/`. Staff paste a sermon in, or add Word (`.docx`), PDF or plain text files, many at once (`POST .../writings/upload/`, one file per request, up to 4 MB). The words are read from the file (`ai_messages/sermon_text.py`); scanned PDFs have no text and are refused with a reason, and older `.doc` files are refused with how to save them as `.docx`. Sermons are private to the branch's staff and never on the website. Files go in the private bucket under server-chosen names and are never linked to.

AI drafts are off for every minister until staff tick **Write a daily message draft from their written sermons each day** on the minister's page; they can also describe how the minister writes. Only those ministers' sermons are ever sent to the AI. For them, the daily job:

1. Reads each waiting sermon: cuts it into passages of about 350 words that overlap by 50, and gets each passage's embedding from Gemini (`gemini-embedding-001`, 1536 numbers, made unit length here). Each row records the model; changing `GEMINI_EMBEDDING_MODEL` puts every sermon back in the queue. Changing a sermon's words does the same for that sermon.
2. Writes **tomorrow's** draft for each of those ministers, unless they already have a message that day: the day has one of 30 themes in turn, the four passages nearest the theme are found with pgvector's cosine distance (sermons used in the last fortnight rest while there are others), and Gemini writes a title, Bible verse, the verse's words and the message in the minister's voice. The draft is saved as a draft (`ai_generated`, with the sermons it came from). Nothing is ever published by itself; staff check it, especially the verse's words, and publish it.

The job is safe to run as often as wanted. Run it with `POST /api/tasks/daily-messages/` (header `X-Sync-Token`, as for the YouTube sync), which works for at most 25 seconds and carries on at the next call, or with the Celery task `church_erp.ai_messages.tasks.generate_daily_messages` (scheduled at 03:17 Zambian time where Celery beat runs). `python manage.py embed_sermon --id <number>` or `--waiting` reads sermons by hand.

Settings: `GEMINI_API_KEY` (empty turns it all off), `GEMINI_MODEL` (default `gemini-flash-latest`, which follows Google's current Flash model) and `GEMINI_EMBEDDING_MODEL`. **Gemini's free tier may use what it's sent to improve Google's products**, so switch to a paid tier, or another provider, before real sermons are added.

### Media library

Staff keep their branch's private files at `/dashboard/content/<branch>/media`, through `/api/staff/<branch>/media/`. A file's kind is decided by what's inside it, not its name. Accepted: photos (JPG, PNG, WebP), PDFs, Word, Excel and PowerPoint files, and MP3 or M4A recordings, up to 4 MB, which is the website host's limit. Photos are saved again as WebP, at most 2560 pixels on the longest side, which removes hidden details such as where they were taken; the website makes them smaller first. Videos are refused, since they belong on YouTube. Everything else is refused too.

Files are stored under names the server chooses, in the private bucket, and the API only hands out signed links that expire after an hour. A file can't be replaced after it's added; its title, description and tags can change. Tags are typed with commas and shared by name across branches, but each branch only sees its own. Deleting a file deletes it from storage too. The list filters with `?type=image|document|audio`, `?tag=` and `?q=`, and `tags/` lists the branch's tags. The old `/api/media/` address is now read-only, because uploads there skipped these checks.

### CSV export

Every section exports at `/api/staff/<branch>/<section>/export/` (sermons, projects, activities, ministers, services, messages and media), with the same rows the person can manage there, all pages at once. The dashboard's lists link to it as "Download as a spreadsheet (CSV)". The media export follows the list's filters and leaves out the links to files. Cells that a spreadsheet would run as a formula start with an apostrophe, and the file starts with the marker Excel needs to read it as UTF-8.

### Branch details and map position

`GET` and `PATCH /api/staff/<branch>/details/` change a branch's contact email (where its Contact form's messages go), phone, address and map position, at `/dashboard/content/<branch>/details`. Staff click the church on a map or paste the position from Google Maps. Positions outside Zambia, half a position, and "confirmed" without a position are refused; extra decimal places are rounded to six (about 10 cm). Superusers change the name and YouTube channel under Branches (below); the web address never changes.

### Staff, branches and change history

`/api/staff-people/` (dashboard: `/dashboard/staff`) lets branch admins see their branch's admins and content editors and add, change, suspend and restore its content editors. Superusers see everyone and manage every branch's admins and editors. Superusers, finance and national roles, and your own account stay in the Django admin, so nobody can lock themselves out or hand out more power from the dashboard. A new account gets a temporary password, shown once, and must choose its own at first sign-in. Suspending sets the account inactive and cancels its sessions at once; restoring lets them sign in again. A new temporary password can be given the same way, and superusers can reset someone's two-step login after a lost phone. Accounts are never deleted here.

`/api/staff-branches/` (dashboard: `/dashboard/branches`, superusers only) adds branches, renames them, sets their YouTube channel ID, and takes them off the website or brings them back. The web address is chosen once and checked against the website's own addresses. Then add the branch's first branch admin from Staff. The `create_branch` command still works for doing both at once.

Every change made through the staff API is recorded in `StaffChange`: who, which branch, which section, what happened and which fields changed, never the values. Saving without changing anything records nothing. Superusers read it at `/api/staff-changes/` (dashboard: `/dashboard/history`), filtered by branch, username or section. Changes made in the Django admin stay in Django's own history.

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
