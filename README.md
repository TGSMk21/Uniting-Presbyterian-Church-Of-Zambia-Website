# Uniting Presbyterian Church In Zambia: Website Platform

One platform for the national church site and a website for each branch. Branch staff manage their own content in a shared admin and can only see and change their own branch.

- **National site** (`/`): the welcome page, fellowships, nationwide events, a map to find a branch (`/find-a-branch`) and a contact page.
- **Branch sites** (`/<branch-slug>`): home, about, sermons, projects and activities, and a contact form that reaches that branch.
- **Staff dashboard** (`/dashboard`): staff sign-in and editing the wording of every page, being built up section by section.
- **Admin** (Django admin): content, staff roles, media library and the record of who changed what.

## How it fits together

| Part | Technology | Hosted on |
|---|---|---|
| Website (`presbyterian-web/`) | Next.js 16, React 19, Tailwind CSS 4, Leaflet with OpenStreetMap | Vercel |
| API and admin (`backend/`) | Django 5.2, Django REST Framework | Render (free plan) |
| Database | PostgreSQL with pgvector | Supabase |
| Uploaded files | One public and one private bucket | Cloudflare R2 |
| Contact form email | Resend, rate limited with Upstash Redis | Hosted services |
| Sermon import | YouTube Data API, run by a scheduled call from cron-job.org | Render |

The website reads everything from the API and caches pages for an hour.

## Project layout

```
backend/              Django API and admin. See backend/README.md
  church_erp/
    core/             Branches, ministers, service times, admin scoping
    accounts/         Staff users and roles
    content/          Sermons, projects, activities, pages, YouTube sync
    media_library/    Photos and documents (private files)
    ai_messages/      Daily messages; AI generation is not built yet
    finance/          Giving records; unused
    api/              API routes and rate limits
presbyterian-web/     Next.js website
  app/(national)/     National site
  app/[branch]/       Branch sites
  app/dashboard/      Staff dashboard
  proxy.js            Keeps dashboard sessions going
  Services/api.js     All calls to the API
  tests/              Website tests
render.yaml           Render deployment settings
PresbyterianSanity/   Retired. See below
```

## Running it locally

You need Python 3.12+, Node.js 20.9+ and a PostgreSQL database.

**Backend.** Full steps are in [backend/README.md](backend/README.md#local-setup). It runs on http://localhost:8000.

**Website.** From `presbyterian-web/`, install the packages:

```bash
npm install
```

Copy the environment template and fill it in. Only `NEXT_PUBLIC_API_URL` is needed to browse; the Resend and Upstash values are for the contact form:

```bash
cp .env.example .env.local
```

Start it on http://localhost:3000:

```bash
npm run dev
```

## Tests

From `backend/`, using an in-memory database:

```bash
python manage.py test --settings=church_erp.settings.test
```

From `presbyterian-web/`:

```bash
npm test
```

## Deploying

Pushing to `master` deploys both the website (Vercel) and the backend (Render). Hosting set-up, storage and the sermon schedule are in [backend/README.md](backend/README.md#deploying-to-render).

## Security

- **API:** rate limited, and anyone can read public content, but only signed-in staff can change it, and only for their own branch.
- **Staff sign-in:** locks after 10 failed attempts for 15 minutes. Only the website's server can reach the sign-in API. Superusers and branch admins must use two-step login, on the Django admin too.
- **Website:** sends a Content-Security-Policy and other security headers (`presbyterian-web/Utilities/securityHeaders.mjs`).

More detail is in [backend/README.md](backend/README.md#security).

## `PresbyterianSanity/` is retired

The site used to run on Sanity CMS. All content now comes from the Django API, and nothing runs or deploys this folder. It's kept only for reference.

## License

This project is private and unlicensed.
