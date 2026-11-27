// The app's one shared cache-first store. No React in here — screens subscribe via useResource.
//
// An entry is { data, fetchedAt, source, status, error }:
//   source: "none" | "api" | "cache" | "offline"
//   status: "loading" (nothing on screen yet) | "refreshing" (showing data, fetching) | "ready"
//   error:  null | "slow" (still loading after slowAfterMs) | "unreachable" (last attempt failed)
//
// Snapshots are new objects on every change and the same object between changes,
// so useSyncExternalStore never sees a mutated snapshot.
export function createStore({
  blobs,
  fetcher, // (url, { timeoutMs }) => Promise<json>
  apiBase,
  now = () => Date.now(),
  coldTimeoutMs = 25000, // no saved copy: the server may be waking up
  warmTimeoutMs = 15000, // a saved copy is already on screen
  slowAfterMs = 6000, // when to say "waking up" if nothing is on screen yet
}) {
  const entries = new Map(); // key -> entry
  const listeners = new Map(); // key -> Set<fn>
  const inflight = new Map(); // key -> Promise<entry>
  const resources = new Map(); // key -> resource (remembered for refreshWatched)

  function emit(key) {
    const entry = entries.get(key);
    const subs = listeners.get(key);
    if (!subs) return;
    for (const fn of [...subs]) fn(entry);
  }

  function setEntry(key, entry) {
    entries.set(key, entry);
    emit(key);
  }

  function peek(key) {
    return entries.get(key);
  }

  function subscribe(key, fn) {
    let subs = listeners.get(key);
    if (!subs) {
      subs = new Set();
      listeners.set(key, subs);
    }
    subs.add(fn);
    return () => {
      subs.delete(fn);
      if (!subs.size) listeners.delete(key);
    };
  }

  function load(resource, { force = false } = {}) {
    const { key } = resource;
    resources.set(key, resource);

    const existing = entries.get(key);
    if (!force && existing && existing.fetchedAt != null && now() - existing.fetchedAt < resource.maxAgeMs) {
      return Promise.resolve(existing); // fresh enough: no network
    }

    // One request per key at a time: a second caller gets the same promise object.
    if (inflight.has(key)) return inflight.get(key);

    const promise = (async () => {
      if (!entries.has(key)) {
        // First touch of this key: read the saved copy and emit it at once.
        const saved = await blobs.get(key);
        if (saved && saved.data !== undefined) {
          setEntry(key, { data: saved.data, fetchedAt: saved.at ?? null, source: "cache", status: "ready", error: null });
        } else {
          setEntry(key, { data: null, fetchedAt: null, source: "none", status: "loading", error: null });
        }
      }
      const atStart = entries.get(key);
      if (!force && atStart.fetchedAt != null && now() - atStart.fetchedAt < resource.maxAgeMs) {
        return atStart; // the saved copy is fresh enough: no network
      }

      const hasData = atStart.data != null;
      setEntry(key, { ...atStart, status: hasData ? "refreshing" : "loading" });
      let slowTimer = null;
      if (!hasData) {
        slowTimer = setTimeout(() => {
          const e = entries.get(key);
          if (e && e.status === "loading") setEntry(key, { ...e, error: "slow" });
        }, slowAfterMs);
        slowTimer.unref?.();
      }
      try {
        const json = await fetcher(apiBase + resource.path, { timeoutMs: hasData ? warmTimeoutMs : coldTimeoutMs });
        if (!resource.validate(json)) throw new Error("unexpected payload");
        const at = now();
        await blobs.set(key, { at, data: json });
        setEntry(key, { data: json, fetchedAt: at, source: "api", status: "ready", error: null });
      } catch {
        // Never overwrite a good saved copy with a failed or invalid answer.
        const latest = entries.get(key);
        if (latest.data != null) {
          setEntry(key, { ...latest, source: "cache", status: "ready", error: "unreachable" });
        } else {
          setEntry(key, { data: null, fetchedAt: null, source: "offline", status: "ready", error: "unreachable" });
        }
      } finally {
        if (slowTimer) clearTimeout(slowTimer);
        inflight.delete(key);
        emit(key);
      }
      return entries.get(key);
    })();

    inflight.set(key, promise);
    return promise;
  }

  // Reload every key someone is currently subscribed to (not forced, so fresh ones are skipped).
  async function refreshWatched() {
    const jobs = [];
    for (const [key, subs] of listeners) {
      if (subs.size > 0 && resources.has(key)) jobs.push(load(resources.get(key)));
    }
    await Promise.all(jobs);
  }

  return { peek, subscribe, load, refreshWatched };
}
