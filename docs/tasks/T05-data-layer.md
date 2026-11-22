# T05 — Cache-first shared data store

**Fixes:** F06 (High), F05 (app part), F29 · **Area:** app · **Branch:** `task/T05` · **Depends on:** nothing (merge after T04 if both are open; the last step touches T04's handler)

## Why

- Every screen goes to the network **first** and waits up to 8 s before showing what's saved, so the app never "opens instantly".
- When the free server is asleep, 8 s is too short, so the person sees "offline".
- About 8 separate hooks fetch the same things again on every return to the app (sermons twice, events twice), with no de-duplication and no "fresh enough" check. That wastes members' data.
- A late answer for the old branch can overwrite the new one.
- Every list, and whole hymn books, are stored in Capacitor Preferences (Android SharedPreferences, which is rewritten as a whole file on every write).

## The design (follow it exactly)

One shared store, keyed by resource. Screens subscribe to a resource. The store shows the saved copy at once, then refreshes from the network only when the copy is older than the resource's `maxAgeMs`, or when the person asks (pull to refresh or the refresh button). Content caches go into files on the phone; Preferences keeps only small settings.

New files:

```
mobile/src/lib/blobStore.js   where saved copies live (files on the phone, localStorage in a browser, memory in tests)
mobile/src/lib/store.js       createStore(): the shared cache-first store (no React)
mobile/src/lib/resources.js   one function per thing the app reads: key, path, validate, maxAgeMs
mobile/src/lib/appStore.js    the app's single store instance
mobile/src/lib/useResource.js the React hook
mobile/src/components/SavedNote.jsx  the one shared "offline/saved/slow" line
```

New dependency, exact version: `npm install --save-exact @capacitor/filesystem@8.1.5`

### `blobStore.js`

```js
const KEY_RE = /^[a-z0-9][a-z0-9.-]*$/;   // throw new Error("bad cache key") otherwise

export function memoryBlobs()   // { get, set, clear, store } for tests
export function webBlobs()      // localStorage under "upcz.c." + key, every call wrapped in try/catch
export function nativeBlobs()   // @capacitor/filesystem, Directory.Data, path `cache/${key}.json`,
                                // Encoding.UTF8, writeFile({ recursive: true }); get() returns null if the file is missing
export function defaultBlobs()  // isNative() ? nativeBlobs() : webBlobs()
// All three: get(key) -> Promise<object|null> (parsed JSON; null on any error),
//            set(key, value) -> Promise<void> (JSON.stringify),
//            clear() -> Promise<void> (removes every saved copy: the whole "cache" folder natively, the "upcz.c." keys on the web)

// One-time clean-up of the old caches kept in Preferences/localStorage by the previous code.
export async function removeLegacyCaches() // native: Preferences.keys(); web: iterate localStorage keys.
// Remove keys that start with: "upcz.home.", "upcz.sermons.", "upcz.messages.", "upcz.message.",
// "upcz.events.", "upcz.announcements.", "upcz.hymns.", and the exact key "upcz.hymnCollections".
// Never touch any other key.
```

### `store.js`

```js
export function createStore({
  blobs,
  fetcher,                 // (url, { timeoutMs }) => Promise<json>; the app passes fetchJSON from api.js
  apiBase,                 // API_BASE from api.js
  now = () => Date.now(),
  coldTimeoutMs = 25000,   // no saved copy: the server may be waking up
  warmTimeoutMs = 15000,   // a saved copy is already on screen
  slowAfterMs = 6000,      // when to say "waking up" if nothing is on screen yet
}) {
  return { peek, subscribe, load, refreshWatched };
}
```

An **entry** is `{ data, fetchedAt, source, status, error }`:
- `source`: `"none"` (nothing yet) | `"api"` (fresh this session) | `"cache"` (saved copy) | `"offline"` (nothing and the network failed)
- `status`: `"loading"` (nothing on screen yet) | `"refreshing"` (showing data, fetching) | `"ready"`
- `error`: `null` | `"slow"` (still loading after `slowAfterMs`) | `"unreachable"` (the last attempt failed)

`peek(key)` returns the current entry, or `undefined`. `subscribe(key, fn)` returns an unsubscribe function, and `fn` is called after every change of that key. Snapshots must be **new objects** on every change and the **same object** between changes (`useSyncExternalStore` needs this).

`load(resource, { force = false } = {})`, where `resource = { key, path, validate, maxAgeMs }`:
1. Remember `resource` by key (for `refreshWatched`).
2. If the key has no entry in memory, read `blobs.get(key)`. A saved copy becomes `{ data, fetchedAt: saved.at, source: "cache", status: "ready", error: null }`; no copy becomes `{ data: null, fetchedAt: null, source: "none", status: "loading", error: null }`. Emit.
3. If not `force`, and `fetchedAt` exists, and `now() - fetchedAt < maxAgeMs`: return the entry without using the network.
4. If a request for this key is already in flight, return that same promise (de-duplication).
5. Set `status` to `"refreshing"` if there's data, otherwise `"loading"`. Emit. If there's no data, start a timer: after `slowAfterMs`, if still loading, set `error: "slow"` and emit.
6. Call `fetcher(apiBase + path, { timeoutMs: data ? warmTimeoutMs : coldTimeoutMs })`.
   - **Success** and `validate(json)` is true: `blobs.set(key, { at: now(), data: json })`, then the entry becomes `{ data: json, fetchedAt: at, source: "api", status: "ready", error: null }`.
   - **Failure, or `validate` false:** don't write. With data: `{ ...entry, source: "cache", status: "ready", error: "unreachable" }`. Without: `{ data: null, fetchedAt: null, source: "offline", status: "ready", error: "unreachable" }`.
7. Clear the timer and the in-flight marker, emit, and return the entry.

`refreshWatched()`: for every key that has at least one subscriber, call `load(remembered resource)` (not forced). The app calls this when it returns to the foreground.

### `resources.js`

```js
const MIN = 60_000;
export const homeResource = (branch) => ({ key: `home.${branch}`, path: `/app/home/?branch=${encodeURIComponent(branch)}`, maxAgeMs: 5 * MIN, validate: (d) => d?.branch?.slug === branch });
export const announcementsResource = (branch) => ({ key: `announcements.${branch}`, …, maxAgeMs: 5 * MIN, validate: slug match && Array.isArray(d.announcements) });
export const sermonsResource = (branch) => (… "sermons", 15 * MIN …);
export const messagesResource = (branch) => (… "messages", 15 * MIN …);
export const eventsResource = (branch) => (… "events", 15 * MIN …);
export const messageResource = (branch, id) => ({ key: `message.${branch}.${id}`, path: `/app/messages/${id}/?branch=…`, maxAgeMs: 24 * 60 * MIN, validate: (d) => d?.id === Number(id) });
export const hymnCollectionsResource = () => ({ key: "hymn-collections", path: "/app/hymns/collections/", maxAgeMs: 24 * 60 * MIN, validate: (d) => Array.isArray(d?.collections) });
export const hymnsResource = (collection) => ({ key: `hymns.${collection}`, path: `/app/hymns/?collection=…`, maxAgeMs: 24 * 60 * MIN, validate: (d) => d?.collection === collection && Array.isArray(d.hymns) });
```
(Fill in the `…` following the same pattern as the first lines.)

### `appStore.js`

```js
export const appStore = createStore({ blobs: defaultBlobs(), fetcher: fetchJSON, apiBase: API_BASE });
```

### `useResource.js`

```js
// resource may be null (no branch chosen): returns { status: "ready", data: null, source: "none", error: null, refresh() {} }.
export function useResource(resource, store = appStore) {
  // useSyncExternalStore(subscribe to resource.key, () => store.peek(key) ?? LOADING_ENTRY)
  // useEffect on resource?.key: store.load(resource)
  // returns { ...entry, refresh: () => store.load(resource, { force: true }) }
}
```
`LOADING_ENTRY` must be one constant object, not a new one each call.

### `SavedNote.jsx`

`<SavedNote entry={…} onRetry={…} />` renders **one** caption line (class `t-caption offline-note`) or nothing:
- `status === "loading" && error === "slow"`: "The church's server is waking up. This can take up to a minute the first time."
- `source === "cache" && error === "unreachable"`: "Couldn't reach the church's server. Showing what was saved on this phone."
- `source === "offline"`: "Couldn't reach the church's server, and nothing is saved on this phone yet.", plus a quiet "Try again" button (`button button-quiet notice-action`) that calls `onRetry`.
- Otherwise, nothing.

## Moving the screens over

Replace every use of `useContentData`, `useHome`'s loader, `loadCached`, `loadHome`, `loadSermons`, `loadMessages`, `loadAnnouncements`, `loadEvents`, `loadHymnCollections`, `loadHymns` and `loadMessageDetail` with `useResource(...)` or `appStore.load(...)`:

| File | Change |
|---|---|
| `App.jsx` | Announcements: `useResource(branch ? announcementsResource(branch) : null)`. Replace the screens' foreground hooks with **one** listener in `Shell`: `useForegroundRefresh(() => appStore.refreshWatched())`. Once, at start-up: `removeLegacyCaches()` guarded by a Preferences flag `upcz.cacheV2`. **T04's notification handler:** look up the event with `(await appStore.load(eventsResource(branchSlug))).data?.events`. |
| `useHome.js` | Keep only the greeting part (`chooseGreeting`, `greeting`). Home data comes from `useResource(homeResource(branch))`. Keep `pullRefresh` and `refresh` as `entry.refresh`. |
| `Home.jsx` | Use the home entry. Replace the offline notice and "You're offline" line with `<SavedNote>`. `UpdatedRow` keeps "Saved on this phone · " when `source === "cache"`. Remove `useContentData(loadEvents)` for now and keep the "Recently at your branch" fallback reading `data.recent_events ?? []` (T02 adds that field; until then it's simply empty). |
| `Events.jsx` | `useResource(eventsResource(branch))` and `useResource(sermonsResource(branch))`. `<SavedNote>` replaces the offline line. |
| `Sermons.jsx` | `sermonsResource`, `messagesResource`. Opening a message: `appStore.load(messageResource(branch, row.id))`. Leave the rest of the message-opening behaviour for T07. |
| `Hymns.jsx` | `hymnCollectionsResource()`, `hymnsResource(collection)`. |
| `Pages.jsx` (`FavouritesPage`) | **Delete** the stale-marking effect (and its imports). T06 rebuilds it properly. |

When everything is moved, delete `useContentData` and `loadCached` from `useContent.js`/`content.js`, `loadHome` from `home.js`, and the loader functions from `events.js`/`hymns.js`/`content.js`. **Keep** the pure helpers (`filterMessages`, `homeSlots`, `timeAgo`, `sortRecentFirst`, `monthGrid`, `dotsFor`, `filterHymns`, `sortHymns`, `sortAnnouncements`, …) and `useForegroundRefresh`. `loadBranches` in `api.js` stays as it is (its built-in fallback list is special).

## Tests (write first, see them fail)

New `mobile/tests/store.test.mjs`, using `memoryBlobs()` and a fake fetcher that records calls and lets the test resolve or reject them:

1. Nothing saved: the first emit is `loading/none`, then `ready/api`; the copy is saved to blobs.
2. Saved copy: emitted **before** the fetch resolves, with `source:"cache"`; then `api` after.
3. Saved copy younger than `maxAgeMs`: **no** fetch at all.
4. `force: true` fetches even when fresh.
5. Two `load()` calls at once make **one** fetch.
6. Failure with a saved copy: data kept, `source:"cache"`, `error:"unreachable"`.
7. Failure with nothing saved: `source:"offline"`.
8. `validate` false: treated as failure, and the saved copy isn't overwritten.
9. Timeouts: the fetcher receives `coldTimeoutMs` with nothing saved, and `warmTimeoutMs` with a saved copy.
10. Slow hint: with `slowAfterMs: 10` and a fetch that never resolves, after about 30 ms the entry has `error:"slow"`.
11. Two keys (`home.a`, `home.b`): resolving `a` late never changes `b`.
12. `refreshWatched()` reloads only subscribed keys, and only stale ones.
13. `peek` returns the same object between changes (identity check).

New `mobile/tests/blobStore.test.mjs`:
1. `memoryBlobs` round trip and `clear()`.
2. Bad keys (`"../x"`, `"A"`, `""`) throw.

Existing tests: rewrite the loader tests in `content.test.mjs`, `home.test.mjs`, `events.test.mjs`, `hymns.test.mjs` and `announcements.test.mjs` as tests of each resource's `path` and `validate` (including "wrong branch refused"). **Keep every pure-helper test.** In the report, list every test you deleted and the new test that covers it.

**Mutation checks (do, then undo; report each):** (a) remove the in-flight de-duplication, so test 5 must fail; (b) skip the `maxAgeMs` check, so test 3 must fail.

## Acceptance checks

1. Tests, lint and build are clean. `grep -rn "useContentData\|loadCached\|loadHome" mobile/src` finds nothing.
2. In a desktop browser with `VITE_API_URL` pointing at a local backend (`python manage.py runserver`; `local.py` allows every origin), choose a branch, then reload the page: the cards appear immediately from the saved copy. In devtools' Network panel, switching tabs and coming back within 5 minutes makes **no** new requests. Paste a short description of what you saw.
3. Stop the backend and pull to refresh on Home: the saved content stays and the "Couldn't reach the church's server…" line appears.

## Out of scope

Favourites behaviour (T06), event list ordering and greeting changes (T07), hymn reader styling (T08). Don't change any visible design apart from the `SavedNote` wording.
