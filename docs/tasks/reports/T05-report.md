# T05 report

## What I changed
New files:
- `mobile/src/lib/blobStore.js` — `memoryBlobs`/`webBlobs`/`nativeBlobs`/`defaultBlobs` (key regex `^[a-z0-9][a-z0-9.-]*$`, throws "bad cache key" otherwise; native uses Filesystem `Directory.Data`, `cache/<key>.json`, UTF8, `recursive: true`, missing file → null) and `removeLegacyCaches()` (removes only the listed `upcz.*` prefixes + exact `upcz.hymnCollections`).
- `mobile/src/lib/store.js` — `createStore({ blobs, fetcher, apiBase, now, coldTimeoutMs: 25000, warmTimeoutMs: 15000, slowAfterMs: 6000 })` implementing the task's steps 1–7 exactly: saved copy first, maxAgeMs skip, in-flight de-duplication (same promise object), cold/warm timeouts, "slow" hint timer, never overwriting a good saved copy on failure/invalid; `peek`/`subscribe` with new-object-per-change snapshots; `refreshWatched()` reloads only subscribed keys, unforced.
- `mobile/src/lib/resources.js` — `homeResource`, `announcementsResource`, `sermonsResource`, `messagesResource`, `eventsResource`, `messageResource`, `hymnCollectionsResource`, `hymnsResource` with the keys/paths/maxAgeMs/validate from the task.
- `mobile/src/lib/appStore.js` — the single `createStore({ blobs: defaultBlobs(), fetcher: fetchJSON, apiBase: API_BASE })`.
- `mobile/src/lib/useResource.js` — `useSyncExternalStore` hook with one constant `LOADING_ENTRY`; null resource → constant ready/empty entry with a no-op `refresh`.
- `mobile/src/components/SavedNote.jsx` — the one shared caption line with the exact three sentences + quiet "Try again" button.
- `mobile/tests/blobStore.test.mjs` (2 tests), `mobile/tests/store.test.mjs` (13 tests).

Changed:
- `mobile/src/App.jsx` — announcements via `useResource(announcementsResource(branch))`; one `useForegroundRefresh(() => appStore.refreshWatched())` in `Shell`; `removeLegacyCaches()` once guarded by the `upcz.cacheV2` Preferences flag; T04's notification handler now does `const entry = await appStore.load(eventsResource(branchSlug))` and searches `entry.data?.events`.
- `mobile/src/lib/useHome.js` — greeting logic kept; home data from `useResource(homeResource(branchSlug))`; `refresh`/`pullRefresh` are `entry.refresh`; per-screen foreground hook removed.
- `mobile/src/screens/Home.jsx` — uses the home entry; offline notice and "You're offline" line replaced by `<SavedNote entry={home} onRetry={pullRefresh} />`; `useContentData(loadEvents)` removed; "Recently at your branch" fallback now reads `data.recent_events ?? []`; `UpdatedRow` keeps "Saved on this phone · " when `source === "cache"`.
- `mobile/src/screens/Events.jsx` — `useResource(eventsResource/sermonsResource)`; `<SavedNote>` replaces the offline line; `syncReminders` effect still runs only when `events.source === "api"`.
- `mobile/src/screens/Sermons.jsx` — sermons/messages via `useResource`; opening a message does `appStore.load(messageResource(branch, row.id))`; `<SavedNote>` per subtab.
- `mobile/src/screens/Hymns.jsx` — `hymnCollectionsResource()` / `hymnsResource(collection)`; `<SavedNote>`.
- `mobile/src/screens/Pages.jsx` — `FavouritesPage` stale-marking effect deleted with its imports (and the now-unused `branchSlug` prop removed from the page and the App call site; T06 rebuilds it).
- Deleted old loaders: `useContentData` (useContent.js keeps only `useForegroundRefresh`), `loadCached`/`loadSermons`/`loadAnnouncements`/`loadMessages`/`loadMessageDetail` (content.js keeps `contentKey`, `filterMessages`), `loadHome` (home.js keeps `timeAgo`, `homeSlots`, `homeKey`), `loadEvents` (events.js keeps all pure helpers), `loadHymnCollections`/`loadHymns` (hymns.js keeps `filterHymns`, `sortHymns`). `loadBranches` in api.js untouched.
- `mobile/package.json` / lockfile — `npm install --save-exact @capacitor/filesystem@8.1.5` (only new dependency).
- Rewrote the five old loader test files as resource path/validate tests (see mapping below).

## Tests added
- `blobStore.test.mjs`: memoryBlobs round trip + clear; bad keys (`"../x"`, `"A"`, `""`, …) throw on memory and web blobs.
- `store.test.mjs`: the 13 tests from the task (loading→api sequence + save; cache emitted before fetch resolves; fresh copy → no fetch; force fetches; de-dup single fetch + same promise; failure keeps cache with `unreachable`; failure with nothing → offline; validate-false doesn't overwrite the saved copy; cold 25000 / warm 15000 timeouts; slow hint after `slowAfterMs`; late answer for key a never changes b; `refreshWatched` only subscribed + stale keys; `peek` identity between/after changes).
- Resource tests in the five rewritten files (path, key, maxAgeMs, validate incl. "wrong branch refused").

## Tests seen failing first
Yes:

```
$ npm test   (store.test.mjs present, store.js absent)
# Error [ERR_MODULE_NOT_FOUND]: Cannot find module '.../src/lib/store.js' imported from tests/store.test.mjs
# tests 102  # pass 101  # fail 1
```

After `store.js`: `# tests 114 / # pass 114 / # fail 0` at that point; final suite below.

## Deleted tests and what now covers them
| Deleted test | New coverage |
|---|---|
| content.test.mjs: "sermons: api answer is cached under the branch; wrong-branch answer refused" | `sermonsResource` test (path/validate, wrong branch refused) + store tests 1/6/7/8 (cache write, cache-on-failure, offline, invalid not overwriting) |
| content.test.mjs: "sermons: offline serves the saved list; nothing saved means empty offline" | store tests 2/6/7 (saved copy emitted first, kept on failure, offline when none) |
| content.test.mjs: "messages: api, cache and offline behave the same; no branch means no request" | `messagesResource` test + store tests; "no branch" case is `useResource(null)` → EMPTY_ENTRY (no key, no request) |
| content.test.mjs: "message detail: found, cached when offline, null when never seen" | `messageResource` test (key/path/validate, wrong id refused) + store tests 1/6/7/8 |
| home.test.mjs: "no branch means no request and no data" | `useResource(null)` EMPTY_ENTRY; `homeResource` test |
| home.test.mjs: "a good answer comes from the API and is cached under the branch" | `homeResource` test + store test 1 |
| home.test.mjs: "an answer for a different branch is refused" | `homeResource` validate wrong-branch test + store test 8 |
| home.test.mjs: "offline, the cached home of that branch is used…" | store tests 2/6 |
| home.test.mjs: "a hanging request times out and falls back to the cache" | store test 9 (warm timeout passed to fetcher) + tests 6/7 |
| home.test.mjs: "a non-200 or malformed answer is a failure, not a crash" | store test 8 (validate false / fetch throw → failure, saved copy kept) |
| events.test.mjs: "events load like the other content…" | `eventsResource` test + store tests |
| hymns.test.mjs: "collections load and cache globally…; bad payload refused" | `hymnCollectionsResource` test + store test 8 |
| hymns.test.mjs: "a collection downloads fully…; wrong collection refused" | `hymnsResource` test (wrong collection refused) + store tests |
| announcements.test.mjs: "announcements load like the other content…" | `announcementsResource` test + store tests |
Kept unchanged: all pure-helper tests (filterMessages, contentKey, timeAgo, homeSlots, homeKey, sortRecentFirst, eventLabel, upcoming/pastEvents, eventsOnDate, todayIso, monthGrid, dotsFor, formatTime, filterHymns, sortHymns, sortAnnouncements, marks tests).

## Acceptance checks
1. Checks clean:

```
$ npm test
# tests 109
# pass 109
# fail 0
$ npm run lint
> eslint .        (no findings)
$ npm run build
✓ built in 327ms
$ npm run build 2>&1 | grep -cE "IMPORT_IS_UNDEFINED|warn"
0
$ grep -rn "useContentData\|loadCached\|loadHome" src
(no output; exit 1 = nothing found)
```

2 & 3 (browser checks against a local backend): **not run — no browser in this environment.** No chromium/firefox/playwright is installed, and the sandbox blocks curl network requests, so I could not start `manage.py runserver` + `npm run dev` and click through. I did not guess at what would appear. What is verified without a browser: the store serves the saved copy before any fetch (store test 2), skips the network within maxAgeMs (test 3), and `SavedNote`'s three sentences are exactly the task's.

Mutation checks (both done, both caught, both reverted):

```
--- (a) in-flight de-duplication removed ---
not ok 5 - 5. two load() calls at once make one fetch (de-duplication)
# pass 12 / # fail 1
--- (b) maxAgeMs checks skipped ---
not ok 3 - 3. saved copy younger than maxAgeMs: no fetch at all
(also 4, 5, 6 cascade)
--- reverted ---
# tests 13 / # pass 13 / # fail 0
```

## Always-run checks
From `mobile/`: `npm test` → 109/109; `npm run lint` → clean; `npm run build` → `✓ built in 327ms`, 0 warning lines. Backend and website untouched by this task (not re-run).

## Deviations
None. Only files named by the task were touched, plus the five rewritten test files and this report. One structural note: `load()` is a plain (non-async) function so the de-duplicated call returns the *identical* promise object, as the task requires; the fresh-entry fast path returns `Promise.resolve(entry)`.

## Things I could not verify
- Acceptance checks 2 and 3 (reload shows saved copy instantly, no new requests within 5 minutes, offline pull-to-refresh keeps saved content with the "Couldn't reach…" line) need a real browser against a local backend — **not run**: no browser installed here and the sandbox blocks curl to localhost. Do not treat these as checked.
- Real-phone behaviour of `nativeBlobs` (Filesystem `cache/` folder) — unit-tested only via `memoryBlobs`/web stubs; no Android device/emulator available.
- `removeLegacyCaches()` on a real device (Preferences.keys() path) — code-reviewed only.
