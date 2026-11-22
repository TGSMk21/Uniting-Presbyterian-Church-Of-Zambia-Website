# T02 — App API additions: ids, recent events, favourites check, caching

**Fixes:** F07 (backend part), F17 (backend part) · **Area:** backend · **Branch:** `task/T02` · **Depends on:** nothing

## Why

- Sermon rows have no `id`, so the app keys sermons by `video_id`. Every sermon without a video shares the key `""` (F07c).
- The app marks favourites as stale by comparing against the latest 20 sermons and 100 messages, so older favourites are wrongly flagged (F07a). It needs a way to ask "do these ids still exist?".
- The home screen downloads the whole events list just to show recent past events when nothing is upcoming (F17).
- The app endpoints send no cache headers.

**Compatibility rule (applies from now on):** installed apps keep calling old shapes, so **only add fields; never rename or remove one.**

## Changes

### 1. `backend/church_erp/api/app_content.py` and `app_home.py`: sermon `id`

- In **both** `sermon_row` functions, add `"id": sermon.pk` as the first key. Keep `video_id` and every other field exactly as they are.
- Better still, delete the duplicate: make `app_home.py` import `sermon_row` from `app_content.py`. The home rows will then also gain `is_live` and `minister_name`, which is fine (adding only). In `app_home.py`, add `.select_related("minister")` to both the sermons queryset and the `live` query, so this doesn't cause one extra query per row.

### 2. `app_home.py`: `recent_events`

Add a key `"recent_events"` to the home answer:
- If the `events` list (upcoming) is **empty**: the 3 most recent past events of the branch (`date < today`), ordered `-date, -start_time, -pk`, using the same `event_row` shape as `events`.
- Otherwise: `[]`.

### 2b. `app_home.py`: message date and verse text

In the `daily_message` object, add `"date": message.date` and `"verse_text": message.verse_text`. The app needs the date for favourites, and the verse text so a saved message opens complete.

### 3. New endpoint: `GET /api/app/favourites/check/`

In `app_content.py`, add `AppFavouritesCheckView` (`permission_classes = [permissions.AllowAny]`):

- Query parameters: `branch` (required, same `app_branch()` rules: 400/404), `sermons` and `messages`, each an optional comma-separated list of integer ids, for example `?branch=chilanga&sermons=4,9&messages=12`.
- Ignore anything in the lists that isn't a positive integer. Accept at most **200** ids per list and ignore the rest.
- Answer `{"branch": {"slug", "name"}, "sermons": [ids that exist], "messages": [ids that exist]}`. Return the ids sorted ascending.
  - A sermon exists if `Sermon.objects.filter(branch=branch, is_hidden=False, pk__in=ids)`.
  - A message exists if `DailyMessage.objects.filter(minister__branch=branch, status="published", date__lte=today, pk__in=ids)`.
- Use `values_list("pk", flat=True)`; never send content.

In `backend/church_erp/api/urls.py`, add `path('app/favourites/check/', AppFavouritesCheckView.as_view(), name='app-favourites-check')` **before** any catch-all app path, next to the other `app/` paths.

### 4. Cache headers on every `/api/app/` answer

In `app_content.py`, add a mixin and apply it to **every** app view (home, sermons, events, announcements, hymn collections, hymns, messages, message detail, favourites check):

```python
class AppCacheMixin:
    """Short public caching for the app's reads: phones and proxies may reuse an answer for a minute."""
    cache_seconds = 60

    def finalize_response(self, request, response, *args, **kwargs):
        response = super().finalize_response(request, response, *args, **kwargs)
        if request.method == "GET" and response.status_code == 200:
            response["Cache-Control"] = f"public, max-age={self.cache_seconds}"
        return response
```

Write it as `class AppHomeView(AppCacheMixin, APIView)` and so on. For the two hymn views, set `cache_seconds = 3600`.

## Tests (write first, see them fail)

In `backend/church_erp/api/tests/test_app_content.py` (or a new `test_app_favourites_check.py`, reusing the fixtures from `test_app_content.py`):

1. `test_sermon_rows_have_id`: `/api/app/sermons/` rows include `id` equal to the sermon's pk. The same goes for `/api/app/home/` `sermons` rows and `live`. Also check that home's `daily_message` has `date` and `verse_text`.
2. `test_home_recent_events_when_nothing_upcoming`: with only past events, `events == []` and `recent_events` holds at most 3, most recent first.
3. `test_home_recent_events_empty_when_upcoming_exist`: with one upcoming event, `recent_events == []`.
4. `test_favourites_check_returns_existing_ids_only`: ids of an existing sermon, a hidden sermon, another branch's sermon and a missing id → only the first comes back. Do the same for messages: a published one, a `pending_review` one, a future-dated one and another branch's → only the first.
5. `test_favourites_check_ignores_junk`: `sermons=abc,-1,0,,5` doesn't error, and only valid ids are considered.
6. `test_favourites_check_requires_branch`: 400 without `branch`, 404 for an unknown branch.
7. `test_app_answers_are_cacheable`: `/api/app/home/` has `Cache-Control: public, max-age=60`, and `/api/app/hymns/collections/` has `max-age=3600`. A 400 answer has **no** `public` cache header.
8. `test_home_query_count`: with 5 sermons that have ministers, `/api/app/home/` uses a fixed number of queries. Use `assertNumQueries` with the number you observe, and write that number in the report.

**Mutation checks (do, then undo; report each):** (a) remove `is_hidden=False` from the favourites check, so test 4 must fail; (b) set the cache header on all statuses, so test 7 must fail.

## Acceptance checks

1. The new tests pass, and the full backend suite passes.
2. `makemigrations --check`: no changes (this task adds no model fields).
3. The existing app tests still pass. The only allowed edits are adding new field names to exact-field-list assertions (see the README rule on existing tests).

## Out of scope

No model changes. Don't touch the mobile app; T06/T07 use these additions.
