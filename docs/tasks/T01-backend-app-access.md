# T01 — Let the app reach the API (CORS for the app)

**Fixes:** F01 (Critical) · **Area:** backend · **Branch:** `task/T01` · **Depends on:** nothing

## Why

The app runs inside Android's WebView at the origin `https://localhost` (Capacitor's default). The backend only allows the website's origin (`CORS_ALLOWED_ORIGINS` = `FRONTEND_URL`), so the WebView blocks every answer, and the app falls back to "offline" on every screen. Verified: `GET /api/branches/` with `Origin: https://localhost` returns 200 with **no** `Access-Control-Allow-Origin` header.

## The decision (don't change it)

Allow the app's origins **only** for public reads the app uses: `GET`/`HEAD`/`OPTIONS` on paths that start with `/api/app/` or `/api/branches/`. Do **not** add the app origins to `CORS_ALLOWED_ORIGINS`, because that would open the staff endpoints to them too. Use django-cors-headers' `check_request_enabled` signal.

## Changes

### 1. `backend/church_erp/settings/base.py`

Below the existing `CORS_ALLOWED_ORIGINS` block, add:

```python
# The Android app (mobile/) runs in a WebView at these origins. They may only make
# public reads of /api/app/ and /api/branches/; see church_erp/api/cors.py.
APP_CORS_ORIGINS = [
    origin.strip()
    for origin in os.environ.get("APP_CORS_ORIGINS", "https://localhost,capacitor://localhost").split(",")
    if origin.strip()
]
```

Don't change `production.py`; it inherits this from `base.py`. Check that `production.py` doesn't overwrite `APP_CORS_ORIGINS`.

### 2. New file `backend/church_erp/api/cors.py`

```python
"""CORS for the Android app (MOBILE_APP_PLAN.md; review finding F01).

The app's WebView origin is allowed only for public reads the app makes. Staff
addresses stay limited to the website's origin (CORS_ALLOWED_ORIGINS)."""
import re

from django.conf import settings

APP_PATHS = re.compile(r"^/api/(app|branches)/")
SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}


def allow_app_origin(sender, request, **kwargs):
    origin = request.headers.get("Origin", "")
    return (
        origin in settings.APP_CORS_ORIGINS
        and request.method in SAFE_METHODS
        and bool(APP_PATHS.match(request.path_info))
    )
```

### 3. `backend/church_erp/api/apps.py`

Connect the signal in `ready()`:

```python
from django.apps import AppConfig


class ApiConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'church_erp.api'

    def ready(self):
        from corsheaders.signals import check_request_enabled

        from .cors import allow_app_origin

        check_request_enabled.connect(allow_app_origin, dispatch_uid="upcz-app-cors")
```

### 4. New test file `backend/church_erp/api/tests/test_app_cors.py`

Use `APITestCase` and create one active branch in `setUpTestData` (copy the branch setup from `test_app_home.py`). Write these tests **first** and see them fail:

| Test | Request | Expect |
|---|---|---|
| `test_app_origin_allowed_on_app_home` | `GET /api/app/home/?branch=<slug>` with `HTTP_ORIGIN="https://localhost"` | 200 and header `Access-Control-Allow-Origin` == `https://localhost` |
| `test_app_origin_allowed_on_branches` | `GET /api/branches/`, same origin | header present and equal to the origin |
| `test_capacitor_scheme_allowed` | `GET /api/app/hymns/collections/` with `capacitor://localhost` | header == `capacitor://localhost` |
| `test_app_origin_refused_on_staff_paths` | `GET /api/staff-overview/` with `https://localhost` | **no** `Access-Control-Allow-Origin` header (whatever the status) |
| `test_app_origin_refused_for_writes` | `POST /api/app/home/?branch=<slug>` with `https://localhost` | no `Access-Control-Allow-Origin` header |
| `test_unknown_origin_refused` | `GET /api/app/home/?branch=<slug>` with `https://evil.example` | no header |
| `test_website_origin_unchanged` | `GET /api/branches/` with the website origin from `settings.CORS_ALLOWED_ORIGINS[0]` | header == that origin |

Use `response.headers.get("Access-Control-Allow-Origin")`.

**Mutation check (do it, then undo it):** temporarily change `APP_PATHS` to `r"^/api/"` and confirm `test_app_origin_refused_on_staff_paths` fails. Write the result in the report.

### 5. `backend/README.md`

In the section about environment variables or deployment (near where `FRONTEND_URL` is explained), add one short paragraph: `APP_CORS_ORIGINS` is optional, defaults to `https://localhost,capacitor://localhost` (the app's WebView), and only allows public reads of `/api/app/` and `/api/branches/`. Plain words, two or three sentences.

## Acceptance checks

1. All 7 new tests pass. The full backend suite passes (it was 906 tests before this task, so it should now be 913).
2. `makemigrations --check` reports no changes.
3. Paste the mutation-check result.

## Out of scope

Don't change `CORS_ALLOWED_ORIGINS`, `local.py` (it already allows every origin), throttling or any view.
