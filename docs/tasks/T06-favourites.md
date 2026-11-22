# T06 — Favourites fixes

**Fixes:** F07 (High) · **Area:** app · **Branch:** `task/T06` · **Depends on:** T02 (sermon `id`, message `date`, `/api/app/favourites/check/`) and T05 (the store; the old stale effect is already deleted)

## Why

- (a) Favourites were marked "No longer listed" by comparing against the latest 20 sermons and 100 messages, and also for favourites saved under a previous branch.
- (b) The Favourites page copied `favs` into its own state once, so removing a heart left the row on screen, and its write-back could bring back removed favourites.
- (c) Sermons were keyed by `video_id`, so sermons without a video shared one key.
- (d) Saved verses were all titled "Daily verse".
- (e) There's no heart on a daily message opened from the library.

## Decisions (don't change them)

- **Ids:** sermons use the server `id` (T02). Messages use the server `id`. Verses use `` `${branchSlug}:${date}` ``. Hymns use the server `id`.
- **Every favourite stores `branchSlug`** (hymns store `""`, since they're church-wide).
- **No migration:** the app hasn't been released. `readFavs` simply drops sermon favourites whose `id` isn't a positive integer (the old `video_id` ones) and verse favourites whose id has no `:`.
- **The stale check uses the server**, via `GET /api/app/favourites/check/?branch=…&sermons=…&messages=…`, and only for favourites of the **current** branch. Favourites of other branches are left as they are. When offline, nothing changes.
- **One owner of the favourites state:** `App.jsx`. The Favourites page renders straight from the `favs` prop and keeps no copy. Every write goes "read storage → change → write → `setFavs`", so nothing stale is ever written back.

## Changes

### 1. `mobile/src/lib/favourites.js`

- `readFavs(prefs)`: as now, plus the two drop rules above.
- `messageFavItem(m, branchSlug)` → `{ id: m.id, title: m.title, sub: [dateLabel(m.date), m.reference_verse].filter(Boolean).join(" · "), branchSlug, snapshot: m }`
- `verseFavItem(v, branchSlug)`, where `v = { text, ref, date }` → `{ id: \`${branchSlug}:${v.date}\`, title: v.ref || "Daily verse", sub: dateLabel(v.date), branchSlug, snapshot: v }`
- `sermonFavItem(s, branchSlug)` → `{ id: s.id, title: s.title, sub: [dateLabel(s.preached_at), s.reference_verse].filter(Boolean).join(" · "), branchSlug, snapshot: s }`
- `hymnFavItem(h, label)` → as now, plus `branchSlug: ""`.
- `dateLabel(iso)`: `"22 November 2026"` (en-GB, day month year), or `""` when the date is missing.
- `toggleFav` stores `branchSlug` too.
- New pure function: `checkQuery(favs, branchSlug)` returns `null` when the branch has no sermon or message favourites; otherwise the path `` `/app/favourites/check/?branch=${enc(branchSlug)}&sermons=1,2&messages=3` `` (only this branch's ids, at most 200 per list).
- New: `async function applyStale(prefs, branchSlug, answer)`, where `answer = { sermons: [ids], messages: [ids] }`. It **reads storage fresh**, sets `stale` for this branch's sermon and message favourites (`true` if the id isn't in the answer, `false` if it is), leaves everything else untouched, writes, and returns the new favs.
- Delete `markStale`.

### 2. `mobile/src/App.jsx`

- Pass `profile.branchSlug` into every place that builds a fav item. Pass `favs`, `onToggleFav` and `branchSlug` to `MessagePage`.
- Add a `checkStale` callback: if `checkQuery(...)` isn't null, `fetchJSON(API_BASE + path, { timeoutMs: 10000 })`, then `setFavs(await applyStale(prefs, branchSlug, answer))`. Ignore errors (offline means no change). Pass it to `FavouritesPage` as `onCheckStale`.

### 3. `mobile/src/screens/Pages.jsx`, `FavouritesPage`

- Remove the `marked` state. Render from the `favs` prop.
- `useEffect(() => { onCheckStale(); }, [onCheckStale])`: run it once when the page opens.

### 4. Screens that build items

- `Home.jsx`: the verse uses `verseFavItem({ ...data.verse, date: data.date }, branchSlug)` and `isFaved(favs, "verses", \`${branchSlug}:${data.date}\`)`. The message uses `messageFavItem(data.daily_message, branchSlug)`.
- `Sermons.jsx` and `SermonPage.jsx`: `sermonFavItem(s, branchSlug)` and `isFaved(favs, "sermons", s.id)`. Keys in lists: `s.id`. The shared-element `layoutId` becomes `` `sermon-title-${s.id}` `` in both files.
- `MessagePage.jsx`: add a `card-head` with the overline "Daily message" and a `HeartButton` (label "Save this message"), the same way as `SermonPage.jsx`. Use `messageFavItem(message, branchSlug)`.

## Tests (write first, see them fail): `mobile/tests/favourites.test.mjs`

1. `readFavs` drops a sermon favourite with `id: "abc123"` and keeps one with `id: 7`.
2. Two sermons with empty `video_id` but ids 1 and 2 are separate favourites.
3. `verseFavItem({ text, ref: "Psalm 23:1", date: "2026-11-22" }, "chawama")` has title `"Psalm 23:1"` and id `"chawama:2026-11-22"`.
4. `checkQuery` includes only the current branch's ids, returns `null` when there are none, and caps each list at 200.
5. `applyStale` flags only the current branch's missing ids, leaves another branch's favourites untouched, and **reads storage fresh**: save A and B, remove B in storage, then call `applyStale` with an answer listing both; B must not come back.

**Mutation check (do, then undo):** make `applyStale` ignore `branchSlug`; test 5 must fail.

## Acceptance checks

1. Tests, lint and build are clean.
2. In a browser against a local backend: heart a sermon, open Favourites, remove it there, and the row disappears at once. Heart a library message from its page, and it appears under Daily messages.

## Out of scope

Favourites design and layout stay as they are.
