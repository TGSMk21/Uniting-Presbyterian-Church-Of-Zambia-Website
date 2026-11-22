# T08 — Hymns: dashboard form, staff list, reader

**Fixes:** F04 (Critical), F13 (High), F15, F26 · **Area:** backend + website + app · **Branch:** `task/T08` · **Depends on:** T05

## Why

- **Dashboard:** `hymnPayload` splits the verses text on *every* line break, so a 4-line verse is saved as 4 verses. Editing re-saves an existing hymn the same broken way.
- **The edit form** uses `defaultValue` with no `key`, so switching from one hymn to another keeps the old text.
- **The staff list** is paginated at 20 (DRF's default), so the dashboard only sees and searches 20 hymns.
- **App reader:** line breaks inside a verse or chorus collapse into one line.
- **App Hymns tab:** shows no cards at all when the counts can't load.
- **Tilt:** the listener runs while the Hymns tab is hidden.

## Decisions (don't change them)

- **A verse is a block of lines separated by a blank line.** Line breaks inside a verse are kept (`"\n"` inside the verse string).
- **The staff list is light and not paginated:** `id, collection, number, title, verse_count, has_chorus`. The full hymn comes from the detail address when someone presses Edit.
- **The app always shows the three collection cards.** The labels are fixed; the counts are added when known.

## Backend: `backend/church_erp/content/`

1. In `serializers.py`, add `HymnListSerializer` (a plain `ModelSerializer` with the fields above). `verse_count` is a `SerializerMethodField` → `len(obj.verses or [])`; `has_chorus` → `bool(obj.chorus.strip())`.
2. In `serializers.py`, `HymnSerializer.validate_verses` must keep line breaks inside a verse: for each verse, normalise `\r\n` to `\n`, strip trailing spaces from each line, strip the verse, and drop empty verses. Don't split anything.
3. In `staff_hymns.py`, set `pagination_class = None`. Add `get_serializer_class()`: return `HymnListSerializer` when `self.action == "list"`, otherwise `HymnSerializer`. Order the list by `collection, number`.
4. Tests in `content/tests/test_hymns.py`:
   - The list with 25 hymns returns all 25, not paginated, with no `verses` key and with `verse_count`.
   - The detail returns `verses`.
   - Posting `verses: ["Line one\r\nLine two  ", ""]` stores `["Line one\nLine two"]`.

## Website: `presbyterian-web/`

1. New file `Utilities/hymnText.mjs`:
   ```js
   // One verse per block; a blank line starts the next verse. Line breaks inside a verse are kept.
   export function parseVerses(text) { … }   // "\r\n" → "\n"; split on /\n[ \t]*\n/; trim trailing spaces of each line; trim each block; drop empty ones
   export function versesToText(verses) { return (verses ?? []).join("\n\n"); }
   ```
2. `app/dashboard/(staff)/hymns/hymns-actions.js`: `hymnPayload` uses `parseVerses`. (Files with `"use server"` may only export async functions, which is why `parseVerses` lives in `Utilities/`.) Add an exported server action `getHymn(id)` that checks `requireSuperuser()` and returns `staffRequest(\`/staff-hymns/${id}/\`)`'s `data`, or `{ error }`.
3. `app/dashboard/(staff)/hymns/hymns-admin.js`:
   - `openEdit(hymn)` calls `getHymn(hymn.id)` inside `startTransition`, then fills `editing` with `versesToText(full.verses)`.
   - The list row shows `hymn.verse_count` (not `hymn.verses.length`).
   - Give the `<form>` `key={editing.id || "new"}`.
   - The verses label: "Verses (leave a blank line between verses)".
4. `app/dashboard/(staff)/hymns/page.js`: `initialHymns={data ?? []}` (the list is now a plain array).
5. New test file `tests/hymnText.test.mjs`:
   - A 2-verse text with 4 lines each gives 2 verses, each keeping its 3 inner `\n`.
   - `\r\n` input works.
   - Extra blank lines and trailing spaces are dropped.
   - `versesToText(parseVerses(x))` round-trips.

**Mutation check (do, then undo):** change the split back to `/\n{2,}|\n/`; the first test must fail.

## App: `mobile/`

1. `src/design/app.css`: add `.hymn-verse p, .hymn-chorus p { white-space: pre-line; }`.
2. `src/screens/Hymns.jsx`, `HymnsTab`:
   - Show three cards always, from a constant `COLLECTIONS = [{ key: "tumbuka", label: "Tumbuka Hymns" }, { key: "chewa", label: "Chewa Hymns" }, { key: "english", label: "English Hymns" }]`. Take each count from the resource when it's available.
   - Caption: count known and 0 → "No hymns yet"; known and more than 0 → "N hymns"; unknown → "Tap to open".
   - Keep `<SavedNote>` from T05.
3. **Tilt only while visible.** In `App.jsx`, `TabScreen` passes `active` to the screen. `HymnsTab` uses `useDeviceTilt(active && !reduced && !isLowEnd())`.
4. `src/lib/hymns.js`, `filterHymns`: when the search is all digits, put hymns whose number equals it **first**, then the other matches.
5. `tests/hymns.test.mjs`: searching `"1"` with hymns 1, 10 and 21 puts hymn 1 first.

## Acceptance checks

1. Backend, website and app suites, and lint, are all clean.
2. Locally, as a superuser in the dashboard: add a hymn with two 4-line verses, save, press Edit, and the textarea shows the same two blocks. In the app, the reader shows two numbered verses with 4 lines each.
3. Import 30 hymns with bulk import; the dashboard lists all 30 and search finds number 27.

## Out of scope

Hymn content and permissions (Decision 1, still open with the owner).
