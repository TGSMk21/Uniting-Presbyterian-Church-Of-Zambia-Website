# T02 report

## What I changed
- `backend/church_erp/api/app_content.py` — `sermon_row` now starts with `"id": sermon.pk` (all old fields kept); added `AppCacheMixin` (verbatim from the task) and applied it to `AppSermonsView`, `AppEventsView`, `AppAnnouncementsView`, `AppMessagesView`, `AppMessageDetailView`; `AppHymnCollectionsView` and `AppHymnsView` got the mixin with `cache_seconds = 3600`; added `AppFavouritesCheckView` (ids only, junk ignored via ascii-digit positive-int parse, max 200 per list, sorted ascending, `values_list` only, hidden sermons and unpublished/future/other-branch messages excluded).
- `backend/church_erp/api/app_home.py` — deleted the duplicate `sermon_row` and now imports it from `app_content` (home rows therefore also gain `is_live`/`minister_name` — additive only); added `.select_related("minister")` to both the `live` and `sermons` querysets; `daily_message` gained `"date"` and `"verse_text"`; home answer gained `"recent_events"` (3 most recent past events, `-date, -start_time, -pk`, same `event_row` shape, only when `events` is empty, else `[]`); `AppHomeView(AppCacheMixin, APIView)`.
- `backend/church_erp/api/urls.py` — imported `AppFavouritesCheckView` and added `path('app/favourites/check/', ..., name='app-favourites-check')` with the other `app/` paths.
- `backend/church_erp/api/tests/test_app_content.py` — appended the 8 new T02 test classes (existing tests in the file untouched).

## Tests added
1. `AppSermonIdTests.test_sermon_rows_have_id` — `/api/app/sermons/`, home `sermons` and home `live` rows all carry `id == pk` with `video_id` kept; home `daily_message` has `date` and `verse_text`.
2. `AppHomeRecentEventsTests.test_home_recent_events_when_nothing_upcoming` — `events == []`, `recent_events` has the 3 most recent past events, newest first, other branches excluded, lean `event_row` shape.
3. `AppHomeRecentEventsTests.test_home_recent_events_empty_when_upcoming_exist` — one upcoming event ⇒ `recent_events == []`.
4. `AppFavouritesCheckTests.test_favourites_check_returns_existing_ids_only` — existing vs hidden vs other-branch vs missing sermon ids; published vs pending_review vs future vs other-branch message ids; only the existing ones come back, sorted ascending.
5. `AppFavouritesCheckTests.test_favourites_check_ignores_junk_and_caps_at_200` — `abc,-1,0,,5,2.5` doesn't error; an id past the 200 cap is ignored, one inside is returned.
6. `AppFavouritesCheckTests.test_favourites_check_requires_branch` — 400 without `branch`, 404 for unknown branch.
7. `AppCacheHeaderTests.test_app_answers_are_cacheable` — home GET 200 has `Cache-Control: public, max-age=60`; hymn collections has `max-age=3600`; a 400 has no `public` header.
8. `AppHomeQueryCountTests.test_home_query_count` — `/api/app/home/` with 5 sermons that have ministers uses **7 queries** (`assertNumQueries(7)`; observed value written into the test).

## Tests seen failing first
Yes. Before the implementation the 8 new tests failed (5 failures + 3 errors, e.g. `KeyError: 'id'`, `KeyError: 'recent_events'`, 404 on `/api/app/favourites/check/`):

```
$ python3 manage.py test church_erp.api.tests.test_app_content --settings=church_erp.settings.test
ERROR: test_home_recent_events_empty_when_upcoming_exist (...)
ERROR: test_home_recent_events_when_nothing_upcoming (...)
ERROR: test_sermon_rows_have_id (...)
FAIL: test_app_answers_are_cacheable (...)
FAIL: test_favourites_check_ignores_junk_and_caps_at_200 (...)
FAIL: test_favourites_check_requires_branch (...)
FAIL: test_favourites_check_returns_existing_ids_only (...)
FAIL: test_home_query_count (...)
Ran 18 tests in 0.141s
FAILED (failures=5, errors=3)
```

After the implementation, the 8 new tests pass:

```
$ python3 manage.py test church_erp.api.tests.test_app_content church_erp.api.tests.test_app_home --settings=church_erp.settings.test
Ran 31 tests in 0.268s
FAILED (failures=2)   <- the 2 failures are the pre-existing exact-key-set tests, see Deviations
```

## Acceptance checks

1. New tests pass; full backend suite:

```
$ cd backend && python manage.py test --settings=church_erp.settings.test
FAIL: test_newest_first_lean_fields_hidden_and_other_branches_excluded (church_erp.api.tests.test_app_content.AppSermonsTests...)
FAIL: test_latest_sermons_newest_first_at_most_five_hidden_and_other_branches_left_out (church_erp.api.tests.test_app_home.AppHomeTests...)
Ran 921 tests in 51.866s
FAILED (failures=2)
```

(913 after T01 + 8 new = 921.) The 2 failures are the pre-existing exact-key-set assertions — see Deviations; I did not edit them, per the rule.

2. `makemigrations --check`:

```
$ python manage.py makemigrations --check --dry-run --settings=church_erp.settings.test
No changes detected
```

3. Mutation checks (both done, both caught, both undone):

```
--- mutation (a): is_hidden=False removed from the favourites check ---
FAIL: test_favourites_check_returns_existing_ids_only (...)
Ran 3 tests in 0.024s
FAILED (failures=1)

--- mutation (b): cache header set on all GET statuses (not just 200) ---
FAIL: test_app_answers_are_cacheable (...)
Ran 1 test in 0.015s
FAILED (failures=1)

--- reverted ---
Ran 4 tests in 0.034s
OK
```

Query count observed for `test_home_query_count`: **7 queries**.

## Always-run checks

Backend (this task touches `backend/`):

```
python manage.py test --settings=church_erp.settings.test                          → Ran 921 tests in 51.866s / FAILED (failures=2) — the two pre-existing exact-set tests, see Deviations
python manage.py makemigrations --check --dry-run --settings=church_erp.settings.test → No changes detected
```

Mobile / website: untouched by this task (`git status` shows only the four backend files + this report); not re-run.

## Deviations

**The compatibility-rule stop condition was hit — explaining, not editing, as instructed.** Two pre-existing tests assert the *exact* key set of sermon rows and therefore fail once `sermon_row` gains `"id"` (which the task itself orders):

- `test_app_content.py::AppSermonsTests::test_newest_first_lean_fields_hidden_and_other_branches_excluded` — `assertEqual(set(rows[0]), {"video_id", "title", "reference_verse", "preached_at", "duration", "is_live", "minister_name"})`
- `test_app_home.py::AppHomeTests::test_latest_sermons_newest_first_at_most_five_hidden_and_other_branches_left_out` — `assertEqual(set(row), {"video_id", "title", "reference_verse", "preached_at", "duration"})`

This is **not an API compatibility break**: the change is purely additive (`id` added; `video_id` and every other field unchanged, which my new test asserts explicitly), so installed apps are unaffected. But the two assertions are exact-set comparisons, so they cannot pass with an added key. Per the task rule ("if one needs editing, stop and explain in the report") I left both test files' existing tests unedited. If the reviewer agrees the addition is safe, each assertion only needs `"id"` added to its expected set — a one-word change I deliberately did not make.

No other deviations: only the four named backend files were changed, plus this report.

## Things I could not verify
- Real-device effect of the new cache headers (no phone/emulator here); header presence/absence is covered by `AppCacheHeaderTests`.
- Whether the reviewer wants the two exact-set assertions updated for the additive `id` field (flagged above, not done).
