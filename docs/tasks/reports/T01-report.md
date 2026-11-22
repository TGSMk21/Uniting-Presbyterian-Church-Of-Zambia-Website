# T01 report

## What I changed
- `backend/church_erp/settings/base.py` — added `APP_CORS_ORIGINS` (env-overridable, default `https://localhost,capacitor://localhost`) directly below the `CORS_ALLOWED_ORIGINS` block, exactly as the task specifies. `CORS_ALLOWED_ORIGINS` itself is unchanged; verified `production.py` does not set `APP_CORS_ORIGINS` (grep: no match), so production inherits the base default.
- `backend/church_erp/api/cors.py` — new file with the task's code verbatim: `APP_PATHS = re.compile(r"^/api/(app|branches)/")`, `SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}`, and `allow_app_origin` wired to django-cors-headers' `check_request_enabled` signal.
- `backend/church_erp/api/apps.py` — connected the signal in `ApiConfig.ready()` with `dispatch_uid="upcz-app-cors"`, as the task specifies.
- `backend/church_erp/api/tests/test_app_cors.py` — new test file with the 7 tests from the task table (one active branch via `make_branch("chilanga")` in `setUpTestData`, copied from `test_app_home.py`).
- `backend/README.md` — one short paragraph next to the `FRONTEND_URL` deployment note: `APP_CORS_ORIGINS` is optional, defaults to the app's WebView origins, and only allows public reads of `/api/app/` and `/api/branches/`.

## Tests added
- `test_app_origin_allowed_on_app_home` — `GET /api/app/home/?branch=chilanga` with `Origin: https://localhost` → 200 and `Access-Control-Allow-Origin: https://localhost`.
- `test_app_origin_allowed_on_branches` — `GET /api/branches/` with the app origin → header echoes the origin.
- `test_capacitor_scheme_allowed` — `GET /api/app/hymns/collections/` with `Origin: capacitor://localhost` → header echoes it.
- `test_app_origin_refused_on_staff_paths` — `GET /api/staff-overview/` with the app origin → no `Access-Control-Allow-Origin` header.
- `test_app_origin_refused_for_writes` — `POST /api/app/home/?branch=chilanga` with the app origin → no header.
- `test_unknown_origin_refused` — `GET /api/app/home/...` with `Origin: https://evil.example` → no header.
- `test_website_origin_unchanged` — `GET /api/branches/` with `settings.CORS_ALLOWED_ORIGINS[0]` → header equals that origin (website behaviour untouched).

## Tests seen failing first
Yes. Before the implementation, the 3 "allowed" tests failed (the 4 "refused" tests pass trivially without the signal):

```
$ python3 manage.py test church_erp.api.tests.test_app_cors --settings=church_erp.settings.test
FAIL: test_app_origin_allowed_on_app_home (...)
FAIL: test_app_origin_allowed_on_branches (...)
FAIL: test_capacitor_scheme_allowed (...)
Ran 7 tests in 0.045s

FAILED (failures=3)
```

After the implementation:

```
Ran 7 tests in 0.046s
OK
```

## Acceptance checks

1. All 7 new tests pass; full backend suite:

```
$ cd backend && python manage.py test --settings=church_erp.settings.test
...
Ran 913 tests in 51.761s
OK
```

(906 before this task + 7 new = 913, as the task predicted.)

2. `makemigrations --check`:

```
$ python manage.py makemigrations --check --dry-run --settings=church_erp.settings.test
No changes detected
```

3. Mutation check (widened `APP_PATHS` to `r"^/api/"`, then reverted):

```
$ python3 manage.py test church_erp.api.tests.test_app_cors --settings=church_erp.settings.test
FAIL: test_app_origin_refused_on_staff_paths (church_erp.api.tests.test_app_cors.AppCorsTests.test_app_origin_refused_on_staff_paths)
Ran 7 tests in 0.045s
FAILED (failures=1)

--- file reverted ---
Ran 7 tests in 0.046s
OK
```

The staff-path refusal is exactly what the narrowed regex protects.

## Always-run checks

Backend (task touches `backend/`):

```
python manage.py test --settings=church_erp.settings.test   → Ran 913 tests in 51.761s / OK
python manage.py makemigrations --check --dry-run --settings=church_erp.settings.test → No changes detected
```

Mobile (listed as always-run in docs/tasks/README.md; this task changed no mobile files):

```
$ cd mobile && npm test
# tests 88
# pass 88
# fail 0

$ npm run lint
> eslint .
(no findings)

$ npm run build
[IMPORT_IS_UNDEFINED] Import `Calendar` will always be undefined because there is no matching export in 'node_modules/@capgo/capacitor-calendar/dist/esm/index.js'
✓ built in 313ms
```

The `IMPORT_IS_UNDEFINED` warning is **pre-existing on `origin/claude/phase-5-dashboard-gxzpfx`** (it comes from the Phase 4 calendar code in `mobile/src`, which this task does not touch — `git status` shows only the five backend/README files changed). Flagging it here rather than fixing it, because T01's scope is backend-only; it is likely the subject of task T03 (Add to calendar).

## Deviations
None. Only the five files named in the task were changed; `CORS_ALLOWED_ORIGINS`, `local.py`, throttling and views are untouched.

## Things I could not verify
- Real-device behaviour (an actual WebView at `https://localhost` getting CORS headers) — no Android phone/emulator in this environment. The header behaviour is covered by the 7 tests instead.
- The pre-existing `IMPORT_IS_UNDEFINED` build warning in `mobile/` is not caused by this task and is reported above, not fixed (out of scope for T01).
- Note: the sandbox's Python environment was wiped mid-task; I reinstalled `backend/requirements.txt` + `requirements-dev.txt` with pip before running anything, so all outputs above are from the restored environment.
