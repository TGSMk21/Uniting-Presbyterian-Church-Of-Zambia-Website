# UPCZ / Chilanga Presbyterian Church Platform — Agent Execution Plan

**Purpose:** This file is the working plan for any Claude Code agent (or human) picking up this project. It reflects the ACTUAL state of the repo as audited on 2026-11-02 (and re-verified against the code the same day — corrections are marked **[rev]**), not a greenfield plan. Work phase by phase, top to bottom — do not skip Phase 0. After finishing a task, check its box and commit. If a later agent session resumes this file, trust the checkboxes over assumptions.

**Repo root:** `PresbyterianWeb/` containing `backend/` (Django), `presbyterian-web/` (Next.js), `PresbyterianSanity/` (legacy, being retired).

---

## 0. Operating Rules (apply in every phase)

1. **Commit after every completed task**, not after every phase. Small commits, clear messages. Never batch unrelated changes into one commit.
2. **Never commit secrets.** `.env` and `.env.local` must stay gitignored — verify this before the first commit in Phase 0.
3. **Every new content model gets a `branch` FK (direct or via a parent) and is scoped through `BranchScopedAdmin`** (built in Phase 0.2) **and, for its API viewset, through `BranchScopedViewSetMixin`** (built in Phase 0.5). No new admin class or viewset bypasses this.
4. **No raw SQL, no bypassing the Django ORM**, except for the pgvector similarity query in Phase 4, which has no clean ORM equivalent yet.
5. **Every Celery task must be idempotent** — safe to re-run if it fails partway (relevant from Phase 4 onward).
6. **Every external API call (YouTube, OpenAI, Flutterwave/MoMo) must have a timeout and a failure path that doesn't crash the request** — log and degrade gracefully (show cached/last-known content, or an empty state) rather than 500.
7. **Update this file's checkboxes as you go.** If a task turns out to need sub-steps not listed here, add them inline rather than silently improvising.
8. **When a task says "STOP — human decision required,"** do not proceed past it autonomously. Surface the question and wait.

---

## 1. Current State Snapshot (audited 2026-11-02)

**Backend (`backend/`):** Django project `church_erp` with 7 apps (`core`, `accounts`, `content`, `media_library`, `ai_messages`, `finance`, `api`). Models exist for all of them; migrations generated. DRF router wires all viewsets. JWT auth endpoints exist (`accounts/urls.py`). Database is a real Supabase Postgres instance (not local sqlite) — good. `requirements.txt` already includes Celery, Redis, OpenAI, pgvector, django-storages/boto3, django-import-export.

**Known bugs/gaps in the backend:**
- Every admin module (`core`, `content`, `media_library`, `ai_messages`, `finance`) scopes querysets via `request.user.branch_set`, which does not exist on the `User` model (it has a single `branch` FK, not a reverse manager called `branch_set`). **Branch-scoped admin access is currently broken — non-superusers see nothing.**
- **[rev]** Even once filtering works, nothing stops a branch admin from *choosing another branch* in an add/change form, and `accounts/admin.py`'s `UserAdmin` exposes `is_superuser`/permissions fields, so a branch admin with user-change rights could escalate privileges.
- **[rev]** `finance/admin.py` checks `request.user.groups.filter(name='finance_admin')` — a Django *group* — while everything else uses the `User.role` field. Two sources of truth for the same role.
- **[rev] The REST API has no branch scoping at all.** Viewsets only filter by an optional `?branch=` query param. Any `is_staff` user can create/update/delete any branch's sermons, projects, activities, pages, media and daily messages; `MinisterViewSet` only requires *authentication* (default `IsAuthenticatedOrReadOnly`), so any logged-in user can edit any branch's ministers; `GivingRecordViewSet` returns every branch's giving to any `finance_admin`.
- **[rev]** `/api/sermons/<video_id>/` uses `video_id` as the lookup, but `video_id` is neither unique nor required — two branches posting the same video, or two blank IDs, raise `MultipleObjectsReturned` (500).
- `ai_messages` has only a `DailyMessageViewSet`. No transcription, no embedding generation, no RAG retrieval, no Celery task logic — the RAG pipeline described in the spec does not exist yet beyond the data model.
- **[rev] `SermonEmbedding.sermon` is a `OneToOneField`** — only ONE chunk per sermon can exist, which contradicts the chunked design in Phase 4.2. Also, no migration enables the `vector` extension, so `ai_messages/0001_initial` fails on a fresh database that doesn't already have it.
- `finance` has a model and a basic viewset. No payment gateway integration.
- No storage backend wired into settings — `MEDIA_ROOT` points to local disk. Uploads will not survive a redeploy on Railway/Render.
- `celery.py` exists but no task modules found anywhere in the repo. **[rev]** `church_erp/__init__.py` also never imports the Celery app (`from .celery import app as celery_app`), and `celery.py` defaults to `settings.local`.
- **[rev]** `settings/production.py` was reviewed: it already sets `DEBUG=False`, `ALLOWED_HOSTS` from env, HSTS (incl. subdomains/preload), `SECURE_SSL_REDIRECT`, secure session/CSRF cookies. `base.py` already sets `X_FRAME_OPTIONS='DENY'`, `SECURE_CONTENT_TYPE_NOSNIFF`, `SECURE_PROXY_SSL_HEADER`, and CORS to a single `FRONTEND_URL` origin. Missing: whitenoise, `STORAGES`, `DATABASE_URL` parsing.
- **[rev]** `settings/local.py` adds `django_extensions` to `INSTALLED_APPS` but it is not in `requirements.txt` — a fresh `pip install -r requirements.txt` then `manage.py runserver` crashes. `local.py` hardcodes the Supabase *username and host* as fallbacks (not the password, which defaults to empty).
- **[rev]** `seed_chilanga` creates `admin/admin123` plus **placeholder** sermons (random public YouTube IDs, e.g. `dQw4w9WgXcQ`), projects and activities, and sets `Branch.logo` to `""` on a required `ImageField`. It is demo data, not real Chilanga content.
- **[rev]** `django-ckeditor` (CKEditor 4, EOL with known security issues) is in `INSTALLED_APPS` but not used by any model. Remove it or replace it before anything renders `Page.content` as HTML.

**Frontend (`presbyterian-web/`):** New multi-tenant route structure exists — `app/[branch]/` (home, about, sermons, sermons/[videoId], projects-and-activities) and `app/(national)/` (home, branches, contact). A new `Services/api.js` calls the Django backend and is used by at least `[branch]/page.js`.

**Known gaps in the frontend:**
- **[rev]** The old Sanity-based `Services/*.js` files still exist, but **no live route uses them.** Every component that imports them (`components/HomeComponents/*` except `ContactComponets/send-email.js`, `components/AboutComponents/*`, `components/Projects&ActivityComponents/*`, `components/SermonsComponents/{archive-videos,live-now,no-live}.js`) is itself imported by nothing — they are orphaned dead code left over from the deleted flat routes. So are `components/UniversalComponents/{header,footer,drawer,other-page-banner}.js`, `constants/DUMMY_DATA.js` and `Utilities/dataMerge.js`. The only legacy files still in use are `components/SermonsComponents/VideoPlayerComponents/player.js` and `components/HomeComponents/ContactComponets/send-email.js`.
- **[rev]** `Services/Sermons/youtube.js`'s `getLive()` reads the static `YOUTUBE_CHANNEL_ID` but is no longer called by any live route. The only live YouTube call is `getVideos(process.env.YOUTUBE_CHANNEL_ID)` in `player.js` (the "More Sermons" sidebar). **The new `[branch]/sermons` page uses only Django `Sermon` rows; "live" is the manually-set `Sermon.is_live` flag, not YouTube.**
- **[rev] Deploy blocker:** `lucide-react`, `clsx`, `embla-carousel-*` and `react-youtube` are declared in the *repo-root* `package.json`, not in `presbyterian-web/package.json`. Local builds work only because Node resolves up into `../node_modules`. On Vercel with root directory `presbyterian-web/`, `player.js` (`lucide-react`) will fail to build. The root `node_modules` also contains its own copy of `react`.
- **[rev]** `app/[branch]/page.js` is a client component with hardcoded Chilanga copy ("At Chilanga Presbyterian…", "2026 Theme"), a static service schedule, and hero images hot-linked from `image.qwenlm.ai` — every branch's home page currently looks like Chilanga's. It also fetches the daily message from the browser, so the API's CORS must allow the frontend origin and `next.revalidate` has no effect there.
- **[rev]** Contact form: `send-email.js` sends `from: onboarding@resend.dev` to a hardcoded personal address. Resend's sandbox sender only delivers to the Resend account owner, so a verified sending domain is needed before any branch address can receive mail. `contact-form.js` also inverts the rate-limit check (`if (response.success)`), so the "limit reached" message is never shown.
- **[rev]** `app/api/revalidate/route.js` is an unauthenticated leftover Sanity webhook (revalidates the `dailyVerse` tag, and its `catch` block doesn't return a response).
- Old flat routes (`app/page.js`, `app/about/page.js`, `app/sermons/page.js`, etc.) were already deleted in favor of `[branch]` equivalents — this part of the migration is done.

**Git:** The repo's only commits are the original Sanity-only site. **Everything described above — the entire Django backend, the new route structure, `api.js`, the contact form — is uncommitted or untracked.** This is the most urgent risk. **[rev]** The main checkout is on `master`, but GitHub's default branch is an unrelated `main` (see Task 0.1); the untracked tree also contains stray files that must NOT be committed: `query`, `stop` (accidental shell output), and `.playwright-mcp/` (browser-automation snapshots). `upcz_erp_project_spec.md` is the original spec — commit it deliberately or not at all.

---

## Phase 0 — Stabilize (blocking; do this before anything else)

**Goal:** Get the actual current work safely under version control, fix the branch-scoping bug that undermines the whole multi-tenant model, and remove the dual-data-layer risk on the frontend. Nothing in later phases is trustworthy until this phase is done.

### Task 0.1 — Commit the current state
- [x] **[rev] STOP — human decision required: reconcile `main` and `master` first.** On GitHub (public repo `TGSMk21/Uniting-Presbyterian-Church-Of-Zambia-Website`), the default branch `main` (`d42b108`, 3 README-only commits) and `master` (`351454b`, the full Sanity site — what the local checkout tracks) have **no common ancestor**, so a PR from any `master`-based branch into `main` is against unrelated history. Pick one:
  - (a) Make `master` the default branch on GitHub, port the README changes from `main` into a commit on `master`, then delete `main`. Simplest — all local work is already based on `master`.
  - (b) Keep `main` as the default: `git fetch origin main && git switch master && git merge origin/main --allow-unrelated-histories`, resolve the `README.md` conflict, push `master`, then open a PR `master` → `main`. After that, base all work on `main` and retire `master`.
  - **Decision (2026-11-02): (a) keep `master`.** README change ported in commit "Port README title change from main branch"; default branch switched to `master` on GitHub. `main` stays until the Phase 0 PR is merged, then delete it. Work happens on branch `claude/agent-execution-plan-review-77b045`, merged into `master` via PR.
- [x] **[rev]** Local git over HTTPS fails with an SSL certificate error under the OpenSSL backend (likely antivirus/proxy TLS inspection) but works with the Windows certificate store. If `git push`/`git fetch` fail, run `git config --global http.sslBackend schannel` (user's decision — it's a global setting). `gh` CLI calls are unaffected.
- [x] **[rev]** The repo is **public**: everything committed in this task is published immediately. Do the `settings/local.py` credential cleanup from Task 1.3 (remove the Supabase username/host fallbacks) *before* the first backend commit, not after.
- [x] **[rev]** Work on a feature branch, not directly on the default branch (e.g. `git switch -c stabilize/phase-0`); merge via PR.
- [x] Confirm `.gitignore` excludes `backend/.env`, `presbyterian-web/.env.local`, `__pycache__/`, `*.pyc`, `node_modules/`, `.next/`, `staticfiles/`, `media/`
- [x] **[rev]** The root `.gitignore`'s `.env*` rule (and the same rule in `presbyterian-web/.gitignore`) also ignores `backend/.env.example`. Add `!.env.example` / `!backend/.env.example` so the template is committed. Create a matching `presbyterian-web/.env.example` with the Appendix A frontend keys (placeholders only).
- [x] **[rev]** Add `query`, `stop` and `.playwright-mcp/` to `.gitignore` (or delete them — they are accidental artifacts). Never use `git add -A`/`git add .` in this task; add paths explicitly.
- [x] **[rev]** Before staging the backend, run `git add -n backend/` and confirm no `__pycache__/`, `.env` or `media/` paths appear.
- [x] `git add` the backend in full, commit as a standalone commit: `"Add Django backend: core, accounts, content, media_library, ai_messages, finance apps"`
- [x] `git add` the new frontend route structure (`app/[branch]/`, `app/(national)/`, `app/not-found.js`, `Services/api.js`, `components/UniversalComponents/{contact-form,nav-client,footer-client,scroll-reveal}.js`) as a separate commit: `"Add multi-branch Next.js routes and Django API service layer"`
- [x] Commit remaining modified files (`.gitignore`, fonts.js, globals.css, layout.js, player.js, next.config.mjs, logo.png, and the deletions of the old flat routes) with a descriptive message. **[rev]** Do NOT commit the modified `Services/client.js` (it adds a hardcoded Sanity `projectId` fallback) — `git restore` it; it is deleted in Task 0.3 anyway.
- [x] Push to the remote and confirm `git status` is clean

### Task 0.2 — Fix branch-scoped admin access
Create a shared mixin so this logic exists once, not copy-pasted per app.

- [x] Create `backend/church_erp/core/admin_mixins.py`:
```python
from django.contrib import admin

from .models import Branch, Minister


class BranchScopedAdmin(admin.ModelAdmin):
    """Restricts the admin to the logged-in user's branch, unless the user
    is a superuser.

    `branch_lookup`: ORM path from this model to a Branch id (default
    'branch_id'; use e.g. 'minister__branch_id' when branch is reached
    through a FK).
    `branch_field`: name of this model's direct Branch FK, which is locked
    to the user's branch on add/change. Set to None when the model has no
    direct Branch FK (e.g. Branch itself, DailyMessage)."""
    branch_lookup = 'branch_id'
    branch_field = 'branch'

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        if request.user.is_superuser:
            return qs
        if not getattr(request.user, 'branch_id', None):
            return qs.none()
        return qs.filter(**{self.branch_lookup: request.user.branch_id})

    def formfield_for_foreignkey(self, db_field, request, **kwargs):
        if not request.user.is_superuser:
            if db_field.related_model is Branch:
                kwargs['queryset'] = Branch.objects.filter(id=request.user.branch_id)
            elif db_field.related_model is Minister:
                kwargs['queryset'] = Minister.objects.filter(branch_id=request.user.branch_id)
        return super().formfield_for_foreignkey(db_field, request, **kwargs)

    def save_model(self, request, obj, form, change):
        if self.branch_field and not request.user.is_superuser:
            setattr(obj, f'{self.branch_field}_id', request.user.branch_id)
        super().save_model(request, obj, form, change)


class FinanceRoleRequired:
    """Mix in alongside BranchScopedAdmin for finance models. Restricts
    the whole admin module to superusers and users with role='finance_admin'."""
    def has_module_permission(self, request):
        return request.user.is_superuser or getattr(request.user, 'role', None) == 'finance_admin'

    def has_view_permission(self, request, obj=None):
        return self.has_module_permission(request)

    def has_add_permission(self, request):
        return self.has_module_permission(request)

    def has_change_permission(self, request, obj=None):
        return self.has_module_permission(request)

    def has_delete_permission(self, request, obj=None):
        return False  # financial records are never hard-deleted via admin
```
- [x] Update `core/admin.py`: `BranchAdmin` extends `BranchScopedAdmin` with `branch_lookup = 'id'`, `branch_field = None`, and `has_add_permission`/`has_delete_permission` returning `request.user.is_superuser` (only national admins create or remove branches); `MinisterAdmin` extends it with the defaults. Remove the old broken `get_queryset` overrides.
- [x] Update `content/admin.py`: `SermonAdmin`, `ProjectAdmin`, `ActivityAdmin`, `PageAdmin` all extend `BranchScopedAdmin` with the defaults. Remove the old broken overrides.
- [x] Update `media_library/admin.py`: `MediaAssetAdmin` extends `BranchScopedAdmin`. Also set `uploaded_by = request.user` in its `save_model` on create.
- [x] Update `finance/admin.py`: `class GivingRecordAdmin(FinanceRoleRequired, BranchScopedAdmin)` — **[rev] `FinanceRoleRequired` must come first** in the bases, since it is a plain mixin and must override `ModelAdmin`'s permission methods. Replace the `groups.filter(name='finance_admin')` check with the `role` field (one source of truth). Set `recorded_by = request.user` on create.
- [x] Update `ai_messages/admin.py`: `DailyMessageAdmin` extends `BranchScopedAdmin` with `branch_lookup = 'minister__branch_id'`, `branch_field = None` (the `formfield_for_foreignkey` override already limits the `minister` choices). `SermonEmbeddingAdmin` gets `branch_lookup = 'sermon__branch_id'`, `branch_field = None`, and should be read-only.
- [x] **[rev]** Update `accounts/admin.py`'s `UserAdmin`: for non-superusers, make `is_superuser`, `is_staff`, `groups`, `user_permissions` and `branch` read-only (via `get_readonly_fields`), restrict the `role` choices so a branch admin cannot grant `super_admin`/`finance_admin`, and fix its `get_queryset` to return `qs.none()` when `request.user.branch_id` is null (currently `filter(branch=None)` returns every branchless user).
- [x] **[rev]** Note for the manual test: admin users need `is_staff=True` *and* Django model permissions (or a group granting them) to see anything — `BranchScopedAdmin` only narrows what they can already see. Create a `Branch Admin` / `Content Editor` group with the right model permissions (a data migration or a `setup_roles` management command) so this isn't re-done by hand per user.
- [x] Manual test: create two branches and one branch-scoped admin user per branch via shell; confirm each sees only their own branch's records; confirm they cannot pick the other branch in any add/change form; confirm a `content_editor` role user cannot see `GivingRecord` at all (absent from the admin index, not just empty).
- [x] Commit: `"Fix branch-scoped admin access via shared BranchScopedAdmin mixin"`
- **[rev] Done notes (2026-11-02):**
  - The mixin's choice limiting is generic: any FK or M2M to `Branch` or to a model with a `branch` field is limited to the user's branch (covers `Minister` FKs and `DailyMessage.source_sermons`, which the original snippet missed).
  - Extra hole found and fixed: a branch admin could see — and reset the password of — finance admins, national admins and superusers in their own branch. `UserAdmin` now hides any user who isn't a branch-role non-superuser.
  - `GivingRecord.recorded_by` and `MediaAsset.uploaded_by` are read-only in the admin and set to the current user on create.
  - The manual test is replaced by automated tests: `backend/church_erp/core/tests/` (run `python manage.py test --settings=church_erp.settings.test` from `backend/`). `settings/test.py` uses in-memory SQLite.
  - Groups: `python manage.py setup_roles` creates/resets "Content Editor", "Branch Admin" and "Finance Admin" with the right model permissions (idempotent). Run it once per environment after `migrate`.
- [x] **[rev] STOP — human decision required (onboarding gap):** branch admins can now add users to their branch but cannot set `is_staff` or groups (both are privilege fields), so a new content editor can't log in until a superuser grants them. Options: (a) keep it — superuser finishes every onboarding; (b) derive `is_staff` and the role group automatically from `role` on save, so a branch admin's new `content_editor` works immediately. Recommendation: (b). **Decision (2026-11-02): (b), automate it.** Done: `accounts/roles.py` + a `post_save` signal keep each user in their role's group (other groups untouched; `super_admin` gets none); `UserAdmin` gives users added through the admin `is_staff=True` and re-applies the role group after the form saves its groups field; `setup_roles` also syncs users who existed before the groups. A superuser can still untick Staff status to suspend someone. 10 tests, 7 deliberate breakages caught.

### Task 0.3 — Finish retiring Sanity on the frontend
**[rev]** This is mostly a *deletion* task: the new routes already use `Services/api.js` exclusively, and every Sanity-backed component is orphaned (see Section 1). The original grep (`"Services/client\|next-sanity"`) would miss them, because components import e.g. `@/Services/Home/HomeService` and services import `../client`.

- [x] Confirm the orphan list is still accurate: for each file under `components/` and `Services/`, check that nothing under `app/` imports it directly or transitively (e.g. `grep -rn "<basename>" presbyterian-web/app presbyterian-web/components presbyterian-web/Services`). As of this audit the only legacy files reachable from `app/` are `components/SermonsComponents/VideoPlayerComponents/player.js`, `components/HomeComponents/ContactComponets/send-email.js`, `react-email-starter/emails/email-template.jsx`, `Services/Sermons/youtube.js`, and `Utilities/{DateFormatter,durationFomar,ratelimit}.js`.
- [x] Before deleting, check whether any orphaned component holds real content worth keeping that has no Django home yet — in particular `constants/DUMMY_DATA.js` (about/history/vision text, reverend bio) and `components/AboutComponents/*`. If it's real church copy, move it into `Page` records for Chilanga (via admin) rather than losing it.
  - **Done (2026-11-02):** an import-graph scan from every file under `app/` confirmed the 32 orphans exactly. `DUMMY_DATA.js` and `AboutComponents/*` hold template copy ("Grace Community Church", a Tennessee pastor bio, example.com sermons) — nothing real to migrate; still recoverable from git history if needed. The only real-looking details were the minister's name ("Rev. Thomson Mkandawire") and "Chilanga, Lusaka", which already live in Django (`Minister`, `Branch.address`).
- [x] **[rev]** Feature parity decision: the old site had a "daily verse" separate from the daily message. `[branch]/page.js` currently fakes it by reusing `DailyMessage.message` as the verse text. Either drop the separate verse block, or add a `verse_text` field to `DailyMessage`. Record the decision here. **Decision (2026-11-02): add `verse_text`.** Done: `DailyMessage.verse_text` (optional, migration `ai_messages/0002`); the branch home page shows it with its reference, and falls back to the default verse instead of repeating the devotion when it's empty. Also fixed the devotion reference, which read `msg.referenceVerse` (always undefined) instead of `reference_verse`. Checked in a real browser against a live backend for both cases. Phase 4.3's generator should fill `verse_text` too.
- [x] Delete the orphaned files: `Services/client.js`, `Services/Home/`, `Services/Projects & Activities/`, `Services/Sermons/{ArchiveVidsServicee,UpcomingStreamService}.js`, the orphaned components listed in Section 1, `constants/DUMMY_DATA.js`, `Utilities/dataMerge.js`.
- [x] Delete `app/api/revalidate/route.js` (Sanity webhook, unauthenticated). If on-demand revalidation is wanted later, re-add it with a shared-secret check, called from a Django `post_save` signal.
- [x] Remove `next-sanity` and `@sanity/image-url` from `presbyterian-web/package.json`; run `npm install` to update the lockfile; run `npm run build` to confirm nothing still imports them.
- [x] Leave `PresbyterianSanity/` in place for now (do not delete) but stop running or deploying it — it is fully superseded. Note this explicitly in the root README (Phase 6, "Documentation rewrite"). **[rev]** Left in place; the README note happens in Phase 6's documentation rewrite.
- [x] Commit: `"Retire Sanity CMS from the frontend; all content now served from the Django API"`

### Task 0.4 — Make YouTube per-branch
**[rev]** Smaller than originally scoped: the only live YouTube call is `getVideos(process.env.YOUTUBE_CHANNEL_ID)` in `player.js`.

- [x] **STOP — human decision required:** where should sermon listings come from? (a) Django `Sermon` rows only, entered by branch admins (current behaviour of `[branch]/sermons`); or (b) a periodic sync (Celery task, Phase 4.4 infrastructure) that imports each branch's YouTube uploads into `Sermon` rows and sets `is_live` from the YouTube live-search API; or (c) fetch YouTube live in the page as the old site did. Recommendation: (b), so the page stays DB-backed and admins can still add series/verse metadata. Until decided, keep (a). **Decision (2026-11-02): (b) YouTube sync.**
- [x] In `player.js`, call `getBranch(branch)` and pass `branch.youtube_channel_id` to `getVideos()`; when the branch has no channel ID, render the sidebar from `getSermons(branch)` instead. **[rev] Superseded by (b):** `player.js` now reads the sermon and the "More Sermons" list from Django only; an unknown video for the branch is a 404.
- [x] Pass the branch to the sermon lookup too: the detail page currently calls `getSermonByVideoId(videoId)` with no branch, so `/branchB/sermons/<branchA video>` shows branch A's sermon (see the lookup fix in Task 0.5).
- [x] Delete `getLive()` from `youtube.js` unless option (c) was chosen; give the YouTube client a request timeout (Rule 6). **[rev]** Deleted `Services/Sermons/youtube.js` entirely and the `googleapis` package; the backend sync uses `httpx` with a 20s timeout.
- [x] Remove `YOUTUBE_CHANNEL_ID` from `.env.local` once no longer read (keep `YOUTUBE_API_KEY`, which is still a shared credential). **[rev]** No frontend code reads `YOUTUBE_CHANNEL_ID` or `YOUTUBE_API_KEY` any more. `.env.local` lives only in your main checkout: remove `YOUTUBE_CHANNEL_ID`, `PROJECT_ID` and `YOUTUBE_API_KEY` from it, and put `YOUTUBE_API_KEY` in `backend/.env` instead.
- [x] Commit: `"Resolve YouTube channel per branch instead of a single static channel ID"`
- **[rev] Done notes (2026-11-02):**
  - `backend/church_erp/content/youtube_sync.py`: per branch, reads the channel's uploads playlist + `videos.list` (2 quota units per run; `search.list` at 100 units is avoided). Creates a `Sermon` per new public video (title, description, date, new `duration` field), never overwrites staff edits to title/series/etc., skips scheduled (`upcoming`) streams, and makes YouTube the source of truth for `is_live` on branches with a channel. API failures are logged and change nothing.
  - Entry points: Celery task `church_erp.content.tasks.sync_youtube_sermons` (scheduled every 5 min in `CELERY_BEAT_SCHEDULE`) and `python manage.py sync_youtube [--branch <slug>]`. Until Celery beat runs in production (Task 4.4), schedule the command with the host's cron instead.
  - 13 tests with a fake YouTube at the HTTP layer; 8 deliberate breakages all caught. Also run once against the real API for Chilanga's channel: 49 sermons imported, re-run created none.
  - Verified end to end: Django with demo data + a production build of the frontend pointed at it → all branch pages 200, sermon page shows Django data with 5 related sermons, unknown video → 404.

### Task 0.5 — [rev] Branch-scope the REST API
The admin fix in 0.2 does nothing for `/api/*`. Write once, apply everywhere.

- [x] Create `backend/church_erp/core/api_mixins.py` with:
  - `BranchScopedViewSetMixin` — `branch_lookup` like the admin mixin. `get_queryset()`: for unsafe methods (and for any non-public data), non-superusers only get rows where `branch_lookup == request.user.branch_id`; public `GET`s keep the existing `?branch=<slug>` filter. `perform_create()`/`perform_update()`: force `branch=request.user.branch` for non-superusers (reject a request body that names another branch).
  - `IsBranchStaffOrReadOnly` permission — safe methods open; writes require `is_authenticated`, `is_staff` and a non-null `branch_id` (or superuser).
- [x] Apply to `SermonViewSet`, `ProjectViewSet`, `ActivityViewSet`, `PageViewSet`, `MediaAssetViewSet`, `DailyMessageViewSet` (`branch_lookup='minister__branch_id'`), and `MinisterViewSet` (which currently lets *any* authenticated user write). Delete the duplicated per-app `IsStaffOrReadOnly` classes.
- [x] `GivingRecordViewSet`: scope to `request.user.branch_id` unless `role == 'super_admin'`/superuser; disable `DELETE` (records are voided, never deleted — matches `FinanceRoleRequired`).
- [x] `DailyMessageViewSet`: non-public statuses (`pending_review`, `rejected`) should only be visible to staff *of that branch*, not every staff user.
- [x] Sermon detail lookup: make `(branch, video_id)` unique where `video_id` is non-blank (`UniqueConstraint(..., condition=~Q(video_id=''))`), and change the lookup to require `?branch=<slug>` (or a nested route) so it can't 500 on duplicates. Update `getSermonByVideoId(branch, videoId)` in `Services/api.js`.
- [x] Add DRF API tests (`APITestCase`) for: anonymous read OK; branch-A staff cannot `POST`/`PATCH`/`DELETE` branch-B objects; `content_editor` gets 403 on `/api/giving-records/`. These are the regression net for Rule 3.
- [x] Commit: `"Enforce branch scoping on all API viewsets"`
- **[rev] Done notes (2026-11-02):**
  - `core/api_mixins.py`: `IsBranchStaffOrReadOnly`, `BranchScopedViewSetMixin` (unsafe methods only see own-branch rows → 404 for others; create/update into another branch → 403), `MinisterBranchMixin` for `DailyMessage`.
  - National access in the API is `is_superuser`, same as the admin. A `role='super_admin'` user who isn't a superuser is treated like any other branch user — make national admins superusers.
  - Media library is internal (branch staff only, own branch). Giving records: own branch for reads and writes, `DELETE` → 405.
  - `recorded_by`, `uploaded_by` and `DailyMessage.reviewed_by` are read-only in the API and set server-side, so they can't be forged.
  - Migration `content/0002_sermon_unique_video_per_branch` adds a conditional unique constraint. **Before running it on the real database**, check for duplicates: `Sermon.objects.exclude(video_id='').values('branch','video_id').annotate(n=Count('id')).filter(n__gt=1)`.
  - Ambiguous `/api/sermons/<video_id>/` lookups now return 404 instead of 500; `getSermonByVideoId(branch, videoId)` passes `?branch=`. (This also covers Task 0.4's "pass the branch to the sermon lookup" item.)
  - 26 API tests in `backend/church_erp/api/tests/`; mutation-checked (7 deliberate breakages, all caught).

### Task 0.6 — [rev] Make the frontend build self-contained
- [x] Move `lucide-react` and `clsx` (and `embla-carousel-*`/`react-youtube` only if still imported after Task 0.3) into `presbyterian-web/package.json` with `npm install --prefix presbyterian-web <pkg>`.
- [x] Delete the repo-root `package.json`, `package-lock.json` and `node_modules/` (they exist only because packages were once installed from the wrong directory, and ship a second copy of `react`).
- [x] Verify with a clean install the way Vercel will build: `rm -rf presbyterian-web/node_modules && cd presbyterian-web && npm ci && npm run build`.
- [x] Commit: `"Declare all frontend dependencies in presbyterian-web/package.json"`
- **[rev] Done notes (2026-11-02):**
  - After Task 0.3 only `lucide-react` is still imported (by `player.js`); `clsx`, `embla-carousel-*` and `react-youtube` were only used by deleted components, so they were dropped rather than moved.
  - The root `package.json`/`package-lock.json` are deleted from git. The root `node_modules/` folder is untracked and still sits in the main checkout — delete it by hand there (`PresbyterianWeb/node_modules`).
  - Verified with `npm ci && npm run build` in a copy **outside the repo** (inside the repo, Node still resolves the stray root `node_modules`, which hides the bug). Build passes; routes: `/`, `/branches`, `/contact` static (ISR 1h), all `[branch]` routes dynamic.
  - Found and fixed while verifying: `Services/api.js` `fetchAPI` didn't catch network errors, so the build (and any request) crashed whenever the Django API was unreachable — on Vercel the deploy itself would fail. It now has a 10s timeout and returns `null` on any failure (Rule 6). Smoke test with no backend: `/`, `/branches`, `/contact` → 200; `/chilanga/*` → 404; no 500s.
  - Superseded (2026-11-06): self-hosted fonts removed the build-time download, so no TLS flag is needed.
  - Pre-existing lint findings left for Task 1.2b (those pages get reworked there): 1 error (`react/no-unescaped-entities` in `[branch]/projects-and-activities/page.js`) and 8 `@next/next/no-img-element` warnings.

### Task 0.7 — [rev] Backend dev-setup hygiene
- [x] **[rev]** Add `Pillow` to `requirements.txt` — `Branch.logo`/`Minister.photo` are `ImageField`s, and without Pillow `manage.py check` fails (`fields.E210`) on a fresh install. Done early (right after Task 0.1) because every later test depends on it.
- [x] Add `django-extensions` to `requirements.txt` (or a `requirements-dev.txt`, and only add the app in `local.py` when importable).
- [x] Add `from .celery import app as celery_app` / `__all__ = ("celery_app",)` to `church_erp/__init__.py` so Celery loads with Django.
- [x] Remove `ckeditor` from `INSTALLED_APPS` and `django-ckeditor` from `requirements.txt` (unused, EOL). If rich text is needed for `Page.content` later, pick a maintained editor and sanitize HTML server-side (e.g. `nh3`) before the frontend renders it.
- [x] Split `seed_chilanga` into two commands: `seed_demo` (current placeholder sermons/projects/activities — dev only, refuses to run when `DEBUG` is False) and the real onboarding path (Task 2.1's `create_branch`). Remove the hardcoded `admin/admin123` superuser — use `createsuperuser` instead.
- [x] Make `Branch.logo` `blank=True` (the seed already writes `""` into it) and add a migration.
- [x] Add a `backend/README.md` with local setup: venv, `pip install -r requirements.txt`, copy `.env.example` to `.env`, `migrate`, `createsuperuser`, `seed_demo`, `runserver`.
- [x] Commit: `"Fix backend dev setup: dependencies, Celery loading, demo seed"`
- **[rev] Done notes (2026-11-02):**
  - `django-extensions` lives in `requirements-dev.txt`; `settings/local.py` only adds it when importable.
  - `seed_chilanga` is now `seed_demo`: refuses to run unless `DEBUG=True`, creates no users (use `createsuperuser`). The real onboarding command (`create_branch`) is still Task 2.1.
  - `Branch.logo` is optional (migration `core/0003_branch_logo_optional`).
  - Verified: a fresh venv from `requirements.txt` alone passes `manage.py check` with no issues and all 64 tests; the README flow (`migrate` → `setup_roles` → `seed_demo` → `runserver`) works end to end against a throwaway SQLite DB, and the live API returns public data while anonymous writes, `/api/media/` and `/api/giving-records/` return 401.
  - Not done here: `django-cleanup` is in `requirements.txt` but not in `INSTALLED_APPS`, so it does nothing. Decide in Phase 3 (media) whether to enable it — it deletes old files when a `FileField` changes, which is wanted for `MediaAsset` but should be tested against object storage first.

**Phase 0 Definition of Done:** `git status` is clean on a pushed branch; a branch-scoped admin user sees only their branch's data for every model including a negative test on finance, and cannot assign records to another branch; the API tests from Task 0.5 pass; the frontend has exactly one data-fetching layer (`Services/api.js` against Django) and zero remaining Sanity imports; a clean `npm ci && npm run build` inside `presbyterian-web/` succeeds; a fresh backend checkout runs from `backend/README.md` alone; sermons display using each branch's own YouTube channel.

---

## Phase 1 — Core Platform Parity & First Deploy

**Goal:** One real branch (Chilanga) live on the new stack, in production, fully replacing what the old Sanity-based site did. Matches Release 1 of the earlier roadmap, but is now a "finish and ship" phase rather than "build from scratch," since most pieces already exist.

### Task 1.1 — Contact form, branch-aware
- [x] Confirm whether the contact form currently uses a Next.js server action + Resend directly, or calls a Django endpoint — check `components/UniversalComponents/contact-form.js` and `components/HomeComponents/ContactComponets/send-email.js`.
- [ ] Decide and document which path stays (recommendation: keep the existing Next.js server action + Resend — it already works and does not need a backend round-trip): **STOP — if any API keys for Resend currently live only in `.env.local` and not also in the production frontend's environment variables, flag this before deploying.**
- **[rev] Answer to the first item:** it is a Next.js server action (`send-email.js`, `'use server'`) + Resend + Upstash rate limiting, called from the client component `contact-form.js`. No Django endpoint is involved.
- [ ] **[rev] STOP — human decision required:** Resend currently sends from `onboarding@resend.dev`, which only delivers to the Resend account owner's address. Verify a sending domain in Resend (e.g. `upcz.org` or the church's domain — needs DNS access) and switch `from` to an address on it. Branch-aware delivery cannot work until this is done. **Decision (2026-11-02): build now, verify later** — code reads `RESEND_FROM_EMAIL` (falls back to the sandbox sender); **you** still need to verify a domain in Resend and set `RESEND_FROM_EMAIL` + `NATIONAL_CONTACT_EMAIL` in Vercel before launch.
- [x] Make the destination email branch-aware: change the server action's signature to take the branch **slug** (not an email address), look up `contact_email` server-side via `getBranch(slug)`, and use it as `to`. Never accept a `to` address from the client — that would make the form an open mail relay. Set `replyTo` to the visitor's email. The national `/contact` page should send to a national address from a server-side env var (e.g. `NATIONAL_CONTACT_EMAIL`), replacing the hardcoded personal Gmail address.
- [x] **[rev]** Fix the inverted rate-limit check in `contact-form.js` (`if (response.success)` → check for the rate-limited response explicitly), and make `send-email.js` return one consistent shape (`{ ok, reason }`) instead of a mix of `{success:false}`, the Resend error object, `false` and `{messageSent:true}`.
- [x] **[rev]** Use the first entry of `x-forwarded-for` (it can be a comma-separated list) as the rate-limit key.
- [x] Keep the existing rate limiting (Upstash). **[rev]** There is no honeypot today — add a hidden honeypot field and basic server-side length/format validation.
- [x] Commit: `"Make contact form destination branch-aware"`
- **[rev] Done notes (2026-11-02):** `Utilities/contactMessage.js` holds the rules (validation with length limits and no line breaks in the name, first `x-forwarded-for` hop, recipient lookup that refuses non-slug input), tested with `npm test` (Node's built-in runner, 10 tests, 6 deliberate breakages caught). `send-email.js` takes `{ branch, ...fields }`, looks up `contact_email` server-side (or `NATIONAL_CONTACT_EMAIL` for the national page), sets `replyTo` to the visitor, and returns `{ ok, reason }`. A down rate limiter is logged and skipped rather than blocking messages. Verified in a browser against a live backend: a real submission reached the send step and showed a friendly error (no Resend key locally); a honeypot submission showed success without attempting a send.

### Task 1.2 — National landing & branch directory on real data
- [x] Confirm `app/(national)/page.js` and `app/(national)/branches/page.js` call `getBranches()` from `Services/api.js` and render only real branches (no mock/dummy data left — check `constants/DUMMY_DATA.js` usage and remove any remaining reliance on it outside genuinely static placeholder content like the schedule block in `[branch]/page.js`, which is fine to keep as a real recurring schedule, not "mock data").
- [x] Each branch directory entry links to `/[slug]` correctly.
- [x] Commit if changes were needed: `"Wire national landing and branch directory to live branch data"`
- **[rev] Done notes (2026-11-02):** both pages already used `getBranches()` and linked to `/<slug>`. The hardcoded "Nationwide events" (3 of 4 dates already past) are replaced — decision: show upcoming activities of every active branch (`/api/activities/?date__gte=<today>`, soonest first, labelled with the branch; inactive branches excluded); the section hides when empty. National events are entered as an activity of the host branch. The fellowship cards stay as static copy. The national contact details in `(national)/layout.js` and `contact/page.js` (`hello@upcz.org`, `+260 977 681 606`) are still hardcoded — confirm they're real before launch.

### Task 1.2b — [rev] Make the branch pages branch-generic
Every branch currently renders Chilanga's home page.
- [x] `app/[branch]/page.js`: replace hardcoded copy ("At Chilanga Presbyterian…", the yearly theme, hero text) with data from `getBranch(slug)` and/or `Page` records (e.g. a `home` page slug). Add fields to `Branch` (e.g. `tagline`, `year_theme`, `hero_image`) if `Page` is too loose.
- [x] Replace the hero images hot-linked from `image.qwenlm.ai` with images served from the media library/branch record (and remove that host from `next.config.mjs` `images.remotePatterns`). Third-party AI-image URLs can disappear without notice.
- [x] Move the service schedule (`scheduleData`) to a per-branch source — a small `ServiceTime` model (branch, day, title, time, location) or a JSON field on `Branch`. Each branch has its own service times.
- [x] Convert `[branch]/page.js` to a server component (fetch on the server like the other `[branch]` pages), keeping only the interactive bits as client components. This removes the browser→Django call and its CORS dependency, and makes `revalidate` effective.
- [x] `app/[branch]/about/page.js`: remove the `info@freedompresbyterian.org` fallback email; render nothing when the branch has no `contact_email`.
- [x] `app/[branch]/sermons/page.js`: `getSermons()` returns the first page of 20 only — add pagination or a "load more".
- [x] Commit: `"Render branch home/about pages from branch data instead of hardcoded Chilanga content"`
- **[rev] Done notes (2026-11-02):** decision: dedicated fields. `Branch` gained `tagline`, `welcome_text`, `year_theme_title`, `year_theme_text`, `hero_image`, `hero_image_secondary`; new `ServiceTime` model edited inline on the branch admin page (Branch Admin group can manage it). The home page is now a server component and hides sections without data (theme, devotion, schedule, hero images) instead of showing Chilanga's. Also fixed along the way: the devotion signature came from a hardcoded "Reverend T. Mkandawire" and two filler paragraphs were appended to every message (now: the message's own paragraphs, signed by its minister via the new `minister_name` API field); the about page showed **invented credentials** for a real person (an MDiv, "CCAP Ordained Minister") and fake fallback phone/email/address — now it shows only the minister's own bio/photo and the branch's real details, with a Google Maps link instead of the "Map placeholder" box; the sermon archive pages 20 at a time and the dead "Browse Archive" anchor works. Uploaded hero images and minister photos are served in development only until object storage lands (Phase 3). Verified in a browser with a fully filled-in branch and an empty one.

### Task 1.3 — Review and complete `settings/production.py`
- [x] **[rev] Already done in the existing file / `base.py`:** `DEBUG = False`; `ALLOWED_HOSTS` from env; `SECURE_SSL_REDIRECT`; `SESSION_COOKIE_SECURE`; `CSRF_COOKIE_SECURE`; HSTS; `X_FRAME_OPTIONS='DENY'`; CORS limited to `FRONTEND_URL` (no `CORS_ALLOW_ALL_ORIGINS` outside `local.py`).
- [x] Make `CORS_ALLOWED_ORIGINS` accept a comma-separated list (production domain + `www` + Vercel preview URL) and set `CSRF_TRUSTED_ORIGINS` for the admin domain.
- [x] Fail fast in production if `DJANGO_SECRET_KEY` is unset (base.py currently falls back to `"insecure-dev-key-change-in-production"`) or `DJANGO_ALLOWED_HOSTS` is empty.
- [x] Static files via `whitenoise` (add to `requirements.txt`, add middleware right after `SecurityMiddleware`, set `STORAGES["staticfiles"]`). Add `gunicorn` to `requirements.txt`.
- [x] `DATABASE_URL` parsed from env (`dj-database-url`), with `conn_max_age` and `sslmode=require`. **[rev]** Supabase's pooler on port 6543 (transaction mode) needs `DISABLE_SERVER_SIDE_CURSORS = True`; port 5432 (session mode) does not — document which one is used.
- [x] Remove the Supabase username/host fallbacks from `settings/local.py` (the password is not hardcoded, but the project ref in the username shouldn't be in a public repo either) — read everything from `.env`.
- [x] Add a `LOGGING` config that sends errors to stdout so the host's log viewer captures them.
- [x] Commit: `"Complete production settings for deployment"`
- **[rev] Done notes (2026-11-02):** `settings/production.py` refuses to start (ImproperlyConfigured naming the variable) without `DJANGO_SECRET_KEY` (or with the dev default), `DJANGO_ALLOWED_HOSTS`, `DATABASE_URL` or `FRONTEND_URL`. `DEBUG` is always False. Hosts/origins are comma-separated lists; `CSRF_TRUSTED_ORIGINS` is optional. `DATABASE_URL` is parsed with SSL required, `conn_max_age=600` and health checks; port 6543 (Supabase transaction pooler) disables server-side cursors automatically. Whitenoise serves hashed, immutable static files; logs go to stdout. 8 subprocess-based tests (including `check --deploy --fail-level WARNING`) plus a manual check that `collectstatic` works and the admin CSS is served with a 1-year cache.

### Task 1.4 — Deploy backend
- **[rev] Decision (2026-11-02): Render, free plan.** Prepared and pushed on branch `claude/render-deploy`:
  - `render.yaml` Blueprint: the free plan has no pre-deploy commands, so `migrate` and `setup_roles` run in the start command.
  - `RENDER_EXTERNAL_HOSTNAME` is added to `ALLOWED_HOSTS` automatically.
  - `POST /api/tasks/sync-youtube/`, protected by an `X-Sync-Token` header, replaces cron (not available on the free plan). An external scheduler (cron-job.org) calls it every 10 minutes, which also keeps the service awake.
  - Step-by-step guide: `backend/README.md`, "Deploying to Render".
  - Known free-plan limits: no shell (run management commands locally against the Supabase session-pooler URL); 750 free hours/month covers exactly one always-awake service; uploaded media isn't persisted (Phase 3).
- [x] Create a Railway (or Render) project, connect the GitHub repo, set the root to `backend/`.
- [x] Set all required env vars (see Appendix A) in the hosting dashboard — never commit them.
- [x] Confirm `DJANGO_SETTINGS_MODULE=church_erp.settings.production` is set for the deployed service.
- [x] Run `python manage.py migrate` against the production database (via the platform's one-off command feature).
- [ ] **[rev]** Do NOT run the demo seed in production (it creates placeholder sermons with random YouTube videos and a weak superuser). Instead: `python manage.py createsuperuser` with a strong password, then create the Chilanga branch with `create_branch` (pull Task 2.1 forward) or via Django Admin, and enter its real sermons/projects/activities.
- [x] Run `python manage.py collectstatic --noinput` as part of the build/release step.
- [x] **[rev]** Run `python manage.py setup_roles` once after `migrate`.
- [ ] **[rev]** Schedule the YouTube sync: either a Celery worker + beat (Task 4.4) or a cron job running `python manage.py sync_youtube` every 5–15 minutes. Run it once by hand after creating the Chilanga branch to import its sermons.
- [x] Confirm `/api/branches/` responds correctly from the deployed URL.
- [x] Commit any deploy-config files added (e.g. `Procfile`, `railway.json`, `nixpacks.toml`) : `"Add backend deployment configuration"`
- **[rev] Live (verified 2026-11-03):** `https://upcz-backend.onrender.com` serves `/api/branches/` (200, ~1–3s), `/admin/login/` (200); the sync endpoint is enabled (403 without the token). Still open on your side: schedule the cron-job.org sync (Chilanga had only the 6 demo sermons, none from YouTube, at the time of checking), remove the demo sermons/projects/activities, deal with any old `admin`/`admin123` user, and add real content.

### Task 1.5 — Deploy frontend
- [x] Set `NEXT_PUBLIC_API_URL` in Vercel's project env vars to the deployed backend URL (not `localhost:8000`).
- [x] Set all other required frontend env vars in Vercel (Resend, Upstash — see Appendix A; **[rev]** YouTube now lives on the backend).
- [x] Connect the Vercel project to the GitHub repo, root directory `presbyterian-web/`.
- [x] **[rev]** Remove `PROJECT_ID` (Sanity) and `YOUTUBE_CHANNEL_ID` from the Vercel env vars if they were ever set there.
- [ ] Deploy and smoke-test the full flow: national landing loads branches → `/chilanga` loads real sermons/projects/activities/daily message → contact form delivers an email to Chilanga's `contact_email` → sermons page shows Chilanga's sermons (from whichever source was chosen in Task 0.4) and a sermon detail page shows "More Sermons" from Chilanga's own channel → an unknown slug (e.g. `/does-not-exist`) shows the 404 page.
- [ ] Point the real domain (if purchased) at this Vercel deployment; otherwise note the `.vercel.app` URL as the current production URL.
- **[rev] Vercel production branch (2026-11-06):** it was `main`, the old README-only branch, so pushes to `master` only built previews. It's now `master`. The API route used (`PATCH /v9/projects/{project}/branch`) isn't in Vercel's public docs; the setting read back correctly.
- **[rev] Fonts (2026-11-06):** `next/font/google` failed about 1 clean build in 6 (6 runs, on Vercel too) with "queries have exactly one entry", and always without the TLS flag on a machine with Avast HTTPS scanning. Fonts now come from `@fontsource` packages via `next/font/local`: 12 of 12 clean builds passed with no flag and no requests to Google. `NEXT_TURBOPACK_EXPERIMENTAL_USE_SYSTEM_TLS_CERTS` is no longer needed.
- **[rev] Live (verified 2026-11-03):** `https://uniting-presbyterian-church-of-zamb-navy.vercel.app`: `/`, `/branches`, `/contact`, `/chilanga`, `/chilanga/sermons`, `/chilanga/about` all 200. The full smoke test (contact email delivery, real YouTube sermons) waits on Resend domain verification and the sync schedule; the custom domain is still to do.

**Phase 1 Definition of Done:** Chilanga's site is live in production end-to-end on the new stack, the old Sanity-based deployment (if still live anywhere) can be decommissioned, and this is explicitly confirmed with whoever is the Chilanga branch stakeholder before moving on.

---

## Phase 2 — Multi-Branch Onboarding

**Goal:** All remaining UPCZ branches (fewer than 10 total) live, each with a working branch-admin login.

### Task 2.1 — Generalize the onboarding flow
- [x] **[rev]** (Needed for Task 1.4 — do this before the first deploy.) Add a reusable `create_branch` command (Task 0.7 already turned `seed_chilanga` into the dev-only `seed_demo`; reuse its structure) taking `--name`, `--slug`, `--contact-email`, `--youtube-channel-id`, and creating one `branch_admin`-role `User` for it with a generated temporary password printed to stdout (never emailed in plaintext without being told to).
- [x] Document the command's usage in `backend/README.md` (created in Task 0.7; Phase 6's "Documentation rewrite" covers the root README).
- [x] Commit: `"Add general-purpose branch onboarding command"`
- **[rev] Done notes (2026-11-03):** `create_branch` validates slug/email/channel ID, refuses an existing slug or username, creates the branch and a `<slug>-admin` Branch Admin login in one transaction, and prints a 16-byte random temporary password. Optional `--youtube-channel-id`, `--phone`, `--address`, `--admin-username`, `--admin-email`. 8 tests, 6 deliberate breakages caught. Usage is in `backend/README.md` ("Onboarding a branch"); on Render's free plan run it locally against the production database.

### Task 2.2 — Onboard remaining branches
- **[rev] Main branches (2026-11-06, list given by the project owner):** Chilanga, Kanyama, St Columbus Kabwe, David Livingstone Memorial, Chawama, Matero, Kabwata, Kaunda Square, Kabanana and Misisi. `python manage.py seed_upcsa_branches` adds them with placeholder details: town as the address, and no invented phone, email or logins. The contact form falls back to `NATIONAL_CONTACT_EMAIL` until a branch has its own email. Existing branches keep their details and only gain a map location if they have none. As details arrive, enter them in the admin and add each branch's admin user. The directory and locator show the API's first 20 branches, so add paging before passing 20.
- **[rev] Find a Branch (2026-11-06):** national page `/find-a-branch` (renamed from Find a Church), linked from the nav and footer. The separate Branches page is gone and the landing page has no branch section at all: its hero button and the closing "Find your branch" button link here; `/branches` and `/find-a-church` redirect. Search by name or area, filter by town, "Find the nearest to me" (the browser's position stays in the browser), and a Leaflet map on OpenStreetMap tiles (no API key). `Branch` gained `latitude`, `longitude` and `location_confirmed`. Seeded pins are the centre of each area from OpenStreetMap and show "Approximate area"; directions search by name until `location_confirmed` is ticked. **To do:** enter each church's exact position in the admin and tick Location confirmed. Before heavy traffic, review OpenStreetMap's tile usage policy.
- [ ] For each remaining branch: run the onboarding command, create its `Minister` record(s), enter or migrate its initial sermons/projects/activities/about content via Django Admin.
- [ ] Hand each branch admin their login and a short walkthrough of Django Admin scoped to their branch (even a one-page PDF or a recorded screen share — not a coding task, but track it as done here).
- [ ] Confirm each branch's public page (`/[slug]`) renders correctly with real content.

**Phase 2 Definition of Done:** Every UPCZ branch has a live page reachable from the national directory and a working, correctly-scoped admin login for its own staff.

---

## Phase 3 — Media Library

### Task 3.1 — Wire real storage
- [x] Add the appropriate `STORAGES` setting (Django 5 syntax) to `settings/production.py` using `storages.backends.s3boto3.S3Boto3Storage`, pointed at Cloudflare R2 (or S3) via the existing `AWS_*` env vars already present in `.env.example`.
- [x] Keep local filesystem storage in `settings/local.py` for development — do not require R2/S3 credentials just to run locally.
- [x] Confirm `MediaAsset.file` uploads through Django Admin land in the bucket, not on local disk, when running under production settings.
- [x] Commit: `"Wire media uploads to object storage in production"`

### Task 3.2 — Round out media admin/API
- [x] Add `django-filter` filtering on `MediaAssetViewSet` for `file_type` and `tags` (the package is already in `requirements.txt`).
- [x] Confirm `MediaAssetAdmin` supports bulk tagging and shows file previews for images in the changelist.
- **[rev] Done notes (2026-11-03):** two R2 buckets, because R2 makes a bucket public as a whole. `default` (public: branch images, minister photos) is served from the bucket's public domain with non-expiring links, since cached pages would break on expiring ones. `private` (media-library files) uses signed links that expire after 1 hour. Config is in `settings/storage.py`. Production switches to R2 when `AWS_STORAGE_BUCKET_NAME` is set and refuses to start if any companion variable is missing. Local dev and tests keep both on disk (`media/`, `media_private/`). Media API filters: `?file_type=`, `?tags=`. Admin: image thumbnails in the list, tag filter, horizontal tag picker, and an "Add tag to selected files" bulk action that creates the tag if needed and stays branch-scoped. Tested against moto's fake S3 (real uploads, bucket placement, link shape, no overwrites), plus 9 deliberate breakages, all caught. R2 is configured in production.
- **[rev] Verified live (2026-11-06):** a test image in `upcz` loads from the bucket's `r2.dev` address (200, image/png). A test file in `upcz-private` opens through its signed link (signed, `X-Amz-Expires=3600`), is refused without a signature (400), and isn't reachable through the public address (404). Test records were removed from the database; their small files remain in the buckets because deleting a record doesn't delete its file (see the `django-cleanup` note in Task 0.7). Settings now refuse the same bucket for both roles and an API host or `https://` value in `MEDIA_PUBLIC_DOMAIN`, after both mistakes came up during setup.
- **[rev] Accounts (2026-11-06):** the old `admin` superuser is disabled and `tmk` is the active superuser. Rotating the R2 token was considered and declined by the project owner.

**Phase 3 Definition of Done:** A branch admin can upload and tag event photos/documents through Django Admin, durably stored off the app server.

---

## Phase 4 — AI Daily Messages (RAG Pipeline)

**[rev] Build order (2026-11-07):** Phase 5 (Staff Dashboard) comes first. Staff-facing parts of this phase (sermon upload in Task 4.1, approve and reject in Task 4.5) are built in the dashboard, not the Django admin.

**Goal:** Build the actual pipeline the `SermonEmbedding`/`DailyMessage` models were designed for — currently only the data model and a plain viewset exist.

### Task 4.1 — Written sermons (replaces transcription)
**[rev] Decision (2026-11-06):** no audio and no Whisper. Pastors will provide written sermons later. The pastors' consent is confirmed by the project owner, since the project is being done for the churches.
- [ ] Add a private `SermonDocument` model (minister, title, `text`, optional source file, date), branch-scoped through its minister with `BranchScopedAdmin`. Keep it separate from `Sermon`: those rows drive the public archive and need a `video_id`, and pastors' writing stays internal unless published.
- [ ] Admin: paste text or upload `.txt`, `.docx` or `.pdf`, extracting the text on upload, with bulk upload for a pastor's backlog. Source files go in the private bucket.
- [ ] **Confirm when samples arrive:** the file formats pastors actually use, and whether any are scanned images, which would need OCR.
- [ ] Commit: `"Add written sermon documents for the daily message pipeline"`

### Task 4.2 — Embeddings
- [ ] **[rev] Fix the model first:** `SermonEmbedding.sermon` is a `OneToOneField`, which allows only one chunk per sermon. Change it to `ForeignKey(Sermon, on_delete=CASCADE, related_name='embeddings')`, add `UniqueConstraint(fields=['sermon', 'chunk_index'])`, and generate the migration. Safe to do now — no embeddings exist yet.
- [ ] Enable the `pgvector` extension **via a migration**, not a one-off command, so a fresh database works: add `pgvector.django.VectorExtension()` as the first operation of a migration that `ai_messages/0001_initial` depends on (or insert it at the top of 0001 while no production database has applied it yet).
- [ ] Add an HNSW (or IVFFlat) index on `embedding` with `vector_cosine_ops` once there are more than a few thousand rows.
- [ ] Add `backend/church_erp/ai_messages/services/embeddings.py`: chunk a `SermonDocument`'s `text` (e.g. ~500-token chunks with overlap; **[rev]** `SermonEmbedding` must point at `SermonDocument`, not `Sermon`), call an embeddings API, create one `SermonEmbedding` row per chunk with `chunk_index`, `chunk_text`, `embedding`. **[rev]** The `VectorField` is 1536-dimensional, which matches OpenAI `text-embedding-3-small` (`OPENAI_API_KEY`). The `AI_API_KEY`/`AI_API_MODEL` pair is for generation only — Anthropic has no embeddings endpoint. Pin the embedding model name in settings and store it on each row (or in a setting checked at query time), so a model change forces a re-embed rather than mixing vector spaces.
- [ ] Add a management command `embed_sermon --id <id>` and ensure it's safe to re-run (delete-then-recreate that sermon's embeddings, so it's idempotent per rule 5 in Section 0).
- [ ] Commit: `"Add sermon chunking and embedding generation"`

### Task 4.3 — RAG retrieval + generation
- [ ] Add `backend/church_erp/ai_messages/services/generation.py`: given a `Minister`, run a pgvector cosine-distance similarity query (via `pgvector.django`'s `CosineDistance` or raw `.annotate()` lookup) against that minister's `SermonEmbedding`s to retrieve the most relevant chunks for today's generation; combine them with a style-notes prompt (minister's `bio` plus any additional style notes field — add one to `Minister` if not present) and call the LLM API (`AI_API_KEY`/`AI_API_MODEL` env vars already defined) to produce a draft `title`, `message`, `reference_verse`. **[rev]** `.env.example` still names an outdated model (`claude-sonnet-4-20250514`) — update it to a current model ID when this task starts. Ask for structured output (JSON) so the three fields parse reliably, and skip creating a message if one already exists for that minister and date (idempotency, Rule 5).
- [ ] Save the result as `DailyMessage(status='pending_review', source_sermons=[...])`.
- [ ] Commit: `"Add RAG-based daily message generation service"`

### Task 4.4 — Scheduling
- [ ] Add `backend/church_erp/ai_messages/tasks.py` with a Celery task `generate_daily_messages()` that runs the generation service for every active `Minister` with at least one embedded sermon.
- [ ] Confirm Task 0.7's Celery wiring is in place (`church_erp/__init__.py` imports the app). `celery.py` defaults to `settings.local`, so set `DJANGO_SETTINGS_MODULE=church_erp.settings.production` explicitly on the worker and beat processes in production.
- [ ] Configure `CELERY_BEAT_SCHEDULE` in `settings/base.py` to run this once daily (early morning, in a sensible timezone for Zambia — `Africa/Lusaka`, confirm `TIME_ZONE` setting matches).
- [ ] Confirm a Celery worker and Celery beat process both run in production (**[rev]** beat already schedules the YouTube sync from Task 0.4) (two separate processes on Railway/Render — add both as explicit services/process types).
- [ ] Commit: `"Schedule daily AI message generation via Celery beat"`

### Task 4.5 — Review workflow
- [ ] Extend `ai_messages/admin.py`'s `DailyMessageAdmin` with an admin action `approve_and_publish` that sets `status='published'`, `reviewed_by=request.user`, `published_at=now()` — and a `reject` action setting `status='rejected'`.
- [ ] Confirm the existing `DailyMessageViewSet.get_queryset` (already filters to `status='published'` for non-staff) is sufficient for the public site — it is, per the Phase 0 audit, so no change needed there.
- [ ] Add the `BranchScopedAdmin` lookup from Task 0.2 (`branch_lookup = 'minister__branch_id'`) if not already applied.
- [ ] **[rev]** Add a unique constraint on `DailyMessage(minister, date)` limited to `status='published'`, and pick which message the frontend shows per day (the home page currently shows `results[0]`, i.e. the newest by `-date`, across all ministers of the branch).

### Task 4.6 — Pilot
- [x] **[rev] Consent confirmed by the project owner (2026-11-06)**: the project is being done for the churches, and pastors will supply their sermons.
- [ ] Run the full pipeline for one minister for one real week; every message reviewed and approved manually before publishing.
- [ ] Gather the pastor's feedback on tone/accuracy and adjust the style-notes prompt accordingly before expanding to any other minister.

**Phase 4 Definition of Done:** One real minister has a full week of AI-generated daily messages, each reviewed and approved by them, published live on their branch site. Do not enable this for additional ministers until that pilot is explicitly signed off.

---

## Phase 5 — Staff Dashboard

**[rev] Decision (2026-11-07):** the project owner chose a custom staff dashboard on the website over branding the Django admin, because it will be vital for the future. **Build this before Phase 4**, so the daily message review (Task 4.5) and sermon upload (Task 4.1) are built here instead of in the Django admin.

**Goal:** Staff sign in on the website at `/dashboard` and manage page content and everything else for their branch, without ever opening the Django admin. The Django admin stays as a superuser fallback.

### Task 5.1 — Secure staff sign-in
- [x] Restore login on the API with short-lived tokens, rotation and a blacklist (`/api/auth/` was removed in Phase 6 until something needed it). **[rev]** 15-minute access, 3-day refresh. Sign-in, refresh and sign-out only answer the website's server (`INTERNAL_API_SECRET`); everyone else gets a 404.
- [x] **[rev] Live (verified 2026-11-07):** the owner signed in on the production site with their superuser account, after adding `INTERNAL_API_SECRET` on Render and Vercel.
- [x] **[rev] Two-step live (verified 2026-11-07):** the owner set it up with a real authenticator app and signed in on the production site.
- [x] Keep tokens out of browser JavaScript: the Next.js server sets them as `httpOnly`, `Secure`, `SameSite=Lax` cookies, and sign-out blacklists the refresh token.
- [x] Keep the login lockout working through the API. **Trap:** dashboard calls reach the API from Vercel's servers, so address-based limits and lockouts would treat all staff as one visitor. Pass the visitor's real address in a header protected by a shared secret, and only trust it when the secret matches. Test that one person's failures can't lock out other staff.
- [x] Guard every `/dashboard` route on the server, keep the pages out of search engines, and never cache one person's page for another. Hiding a button is not protection: the API's role and branch checks stay the real gate.
- [x] Temporary passwords must be changed at first sign-in, enforced by the API. Staff can change their own password, which ends their other sessions.
- [ ] Add a forgotten-password flow once Resend's domain is verified. Until then, an admin sets a new temporary password.
- [x] Two-step login for superusers and branch admins before the dashboard is handed to staff. **[rev]** Authenticator app plus 10 one-time recovery codes (`accounts/two_factor.py`). Wrong codes share the sign-in lockout. The Django admin enforces the same rules (`core/admin_site.py`), so it can't be used to skip it. `reset_two_factor` covers a lost phone. Recovery codes can't be regenerated yet: a used-up set means a reset.
- [ ] Commit: `"Add secure staff sign-in for the dashboard"`

### Task 5.2 — Editable page content
Most page wording is hard-coded today: on the national site, the landing page (hero, welcome, fellowships, closing) and the contact page. On branch sites, some fixed wording sits around fields that are already editable (tagline, welcome text, year theme, images). The `Page` model exists, but no website page reads it.
- [x] Add a content model with named fields per page and section, for both the national site and each branch, not one free-form HTML box. Plain text and images only, so edits can't break a layout or inject scripts. **[rev]** `PageContent` stores only changes; `pageSchema.json` (a copy on each side, compared by a test) lists every field. `*stars*` give emphasis. Tagline, welcome text, year theme, hero images and logo stay on `Branch`.
- [x] Seed it with today's wording, and keep the current text as a fallback, so no page goes blank and nothing changes until someone edits it. **[rev]** Unedited national pages were compared word for word with the live site.
- [x] Dashboard section per page, with labelled fields (`/dashboard/pages`).
- [x] Image upload to the public bucket: branch hero images and logos, and the national fellowship images. **[rev]** Images are fields of type `image` in the same schema. The browser shrinks photos first; the API checks each one and saves its own clean WebP copy, then deletes the file it replaced. Branch logos now show in that branch's header and footer. Minister photos come with the ministers section in Task 5.3.
- [x] **[rev] Image upload live (verified 2026-11-07):** the owner uploaded a branch photo on the production site, saw it on the public page straight away, then removed it.
- [x] Permissions: branch staff edit their own branch's pages; national pages are limited to superusers and the existing National Admin role.
- [x] **[rev] Page editing live (verified 2026-11-07):** the owner edited a page on the production site and saw the change straight away.
- [x] Make saved edits appear straight away: the website caches API answers for an hour. **[rev]** Saves go through the website's server, so it clears the cache tag itself (`updateTag`) and no extra endpoint is needed.
- [ ] Decide what to do with the unused `Page` model: reuse it for the new content or remove it.
- [x] Commit: `"Add editable page content for national and branch sites"`

### Task 5.3 — Content sections
- [x] Sermons (titles and verses; YouTube sync must not overwrite staff edits), projects, activities. **[rev]** At `/dashboard/content`, through `/api/staff/<branch>/<section>/`; the public addresses are now read-only. Sermons are added from a YouTube link and hidden rather than deleted, because the sync would import a deleted one again (`Sermon.is_hidden`). The sync already left staff wording alone, and a test now covers hiding too. Saves clear the website's cached copies, including upcoming activities on the national home page.
- [x] **[rev] Branch content live (verified 2026-11-07):** the owner changed a project on the production site and saw it on the public page straight away.
- [x] Ministers and service times. **[rev]** Same addresses and rules as the sections above; public minister addresses are now read-only. Ministers got an order number, because the About page shows only the first and that used to be whoever came first alphabetically. Photos reuse the page image checks. A minister with daily messages can't be deleted, since the messages would go with them. This also brings the minister photos left over from the image upload task.
- [x] **[rev] Ministers and service times live (verified 2026-11-07):** the owner added a service time and a minister photo on the production site and saw both straight away.
- [x] Branch details, including the exact map position that confirms a branch's pin. **[rev]** Contact email, phone, address and map position, at `/api/staff/<branch>/details/`. Staff click the church on a map or paste the position from Google Maps; positions outside Zambia, half a position and "confirmed" without one are refused. Name, web address and YouTube channel stay with superusers for now (branch creation is Task 5.4). Found while testing: refreshing the session of a deleted account crashed with a server error; it now asks them to sign in again.
- [ ] Media library, using the existing private signed links; files must not become public through the dashboard.
- [ ] Daily messages: list, edit and manual entry now; Phase 4 adds AI drafts and approval.
- [ ] CSV export, limited to the rows that person can see.
- [ ] Commit per section.

### Task 5.4 — Staff and activity
- [ ] Branch admins add and suspend content editors for their own branch, and can't grant higher roles or see other branches. Superusers manage everyone and create branches.
- [ ] **Trap:** Django's activity log only records changes made in the Django admin. Add logging on API writes so dashboard changes are recorded with who, what and when, and show it to superusers.
- [ ] Commit: `"Add staff management and activity log to the dashboard"`

### Task 5.5 — Testing and pilot
- [ ] For every section, test that branch A staff can't read or change branch B's data, and that content editors can't reach admin-only sections, through the API as well as the screens.
- [ ] Works on a phone, in plain language, and checked in a real browser, with the security headers on.
- [ ] Pilot with one branch's real staff, and fix what they stumble on before rolling out to the others.

**Phase 5 Definition of Done:** One branch's real staff run their site from `/dashboard` (editing page content and publishing sermons, activities and daily messages) without help and without the Django admin, and a superuser can edit the national pages.

### Finance is out of the plan
**[rev] Decision (2026-11-07):** the project owner removed the finance module (online giving, payment gateways, reporting) from the plan for now, and the dashboard has no finance section. The earlier task list is in git history if it returns. The existing `finance` app and `finance_admin` role stay in the code, unused and staff-only; removing them would be a separate decision. If finance returns, it still needs a UPCZ finance approver and a review under Zambia's Data Protection Act (2021) first.

---

## Phase 6 — Production Hardening & Launch Checklist

- [ ] **Backups:** confirm Supabase's backup/PITR settings for the plan tier in use; if not sufficient, add a scheduled `pg_dump` to object storage.
- [x] **Admin activity logging:** **[rev]** `LogEntry` was recording but had no admin page. Now read-only under Administration > Log entries, superusers only (`core/admin.py`).
- [x] **Rate limiting / throttling:** **[rev]** `api/throttling.py`: 600 requests/min per visitor or user, 60 writes/min per user. Keyed on `CF-Connecting-IP` so a made-up `X-Forwarded-For` can't escape the limit. Reads must stay at 300/min or above because the site builds from shared Vercel addresses. Checked live on 2026-11-06: requests with a different fake `X-Forwarded-For` each still got `429`, first after about 2,080 requests in under a minute, higher than the two-worker estimate of 1,200 (cause not established). The admin login lockout was not tried on production; it's covered by tests only.
- [x] **Security headers:** **[rev]** `presbyterian-web/Utilities/securityHeaders.mjs`, applied in `next.config.mjs`. Inline scripts stay allowed because nonces would force every page to render per request and lose page caching. Images allow any https source so uploads can move to a custom domain.
- [ ] **Admin hardening:** **[rev]** Done: `DJANGO_ADMIN_PATH` env var (default stays `/admin/`) and `django-axes` lockout (10 failures, 15 minutes, by username or address). Two-step login moved to Task 5.1.
- [x] **JWT:** **[rev]** Removed `/api/auth/*`: nothing used it and it had no lockout. Task 5.1 brings it back with rotation and a blacklist for the dashboard.
- [ ] **Dependency audits:** **[rev]** Done: upgraded Next.js to 16.4.5, Resend, React and others; Pillow to 13. `pip-audit` reports none. `npm audit` reports 4 low, all `deepmerge` via `html-to-text` via `@react-email`, with no fix available, used only to render the site's own email template. Still to do: enable Dependabot alerts in GitHub settings (owner); alerts only, since this project doesn't use pull requests.
- [ ] **Monitoring:** **[rev]** Done: `@vercel/analytics` in the root layout, so the national site and every branch are counted, without cookies. Web Analytics enabled in Vercel; a live visit was accepted on 2026-11-07. Still to do (owner): add an uptime check against the frontend and `/api/branches/`.
- [x] **Data export / exit plan:** **[rev]** No export existed despite `import_export` being installed. Every branch-scoped admin list now has CSV export limited to the rows that user can see, and formulas are neutralised. There is no members model to export yet.
- [x] **Documentation rewrite:** **[rev]** Root `README.md` rewritten; `backend/README.md` has a Security section.
- [x] **Deploy race:** **[rev]** A push that deploys both sides made Vercel build Find a Branch while Render was restarting, publishing "0 branches" for up to an hour. `/` and `/find-a-branch` now render on request, so a failed API call isn't kept (`tests/freshPages.test.mjs`).
- [ ] **Governance:** confirm with UPCZ who the institutional point of contact/data owner is, and what happens if the developer is unavailable — not a coding task, but should be explicitly resolved before calling this "launched."

---

## Appendix A — Environment Variables Reference

**Backend (`backend/.env`):**
`DJANGO_SECRET_KEY`, `DJANGO_DEBUG`, `DJANGO_ALLOWED_HOSTS`, `DJANGO_SETTINGS_MODULE` (production host only), `DATABASE_URL` (or discrete `DB_NAME`/`DB_USER`/`DB_PASSWORD`/`DB_HOST`/`DB_PORT`/`DB_SSLMODE` as currently used in `settings/local.py`), `REDIS_URL`, `AI_API_KEY`, `AI_API_MODEL`, `OPENAI_API_KEY`, `YOUTUBE_API_KEY`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_STORAGE_BUCKET_NAME`, `AWS_S3_ENDPOINT_URL`, `FLUTTERWAVE_SECRET_KEY`, `MTN_MOMO_API_KEY`, `MTN_MOMO_ENVIRONMENT`, `FRONTEND_URL`.

**Frontend (`presbyterian-web/.env.local`):**
`NEXT_PUBLIC_API_URL` (Django backend URL, including the `/api` suffix — `Services/api.js` appends paths like `/branches/` directly), `RESEND_API_KEY`, `RESEND_FROM_EMAIL` **[rev]** (address on the verified domain, Task 1.1), `NATIONAL_CONTACT_EMAIL` **[rev]**, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`.
Remove once Phase 0 is done: `PROJECT_ID` (Sanity), `YOUTUBE_CHANNEL_ID` (now per-branch, from the API), `YOUTUBE_API_KEY` (**[rev]** moved to the backend — the YouTube sync runs there). **[rev]** `.env.local` also contains `APP_ENV`, which no code reads — remove it or document its purpose.

---

## Appendix B — Current API Endpoints (`backend/church_erp/api/urls.py`)

`/api/branches/` (lookup by slug: `/api/branches/<slug>/`), `/api/ministers/`, `/api/sermons/` (filter `?branch=<slug>`), `/api/sermons/<video_id>/` (**[rev]** not unique across branches — changes in Task 0.5), `/api/projects/`, `/api/activities/`, `/api/pages/`, `/api/media/`, `/api/daily-messages/` (filter `?branch=<slug>`; public callers only ever see `status=published`), `/api/giving-records/` (**[rev]** unused; finance is out of the plan). **[rev]** `/api/auth/` was removed in Phase 6; Task 5.1 restores it.

---

## Appendix C — App/Model Map

- `core`: `Branch`, `Minister`
- `accounts`: `User` (role: `super_admin` / `branch_admin` / `finance_admin` / `content_editor`)
- `content`: `Sermon`, `Project`, `Activity`, `Page`
- `media_library`: `MediaAsset`, `MediaTag`
- `ai_messages`: `SermonEmbedding` (pgvector, 1536 dims; **[rev]** currently one-to-one with `Sermon`, becomes many-per-sermon in Task 4.2), `DailyMessage`
- `finance`: `GivingRecord`
