import { test } from "node:test";
import assert from "node:assert/strict";
import { createStore } from "../src/lib/store.js";
import { memoryBlobs } from "../src/lib/blobStore.js";

const MIN = 60_000;

// A fetcher that records every call; each call gets manual resolve/reject.
function fakeFetcher() {
  const calls = [];
  const fetcher = (url, opts) => {
    const call = { url, opts };
    call.promise = new Promise((resolve, reject) => {
      call.resolve = resolve;
      call.reject = reject;
    });
    calls.push(call);
    return call.promise;
  };
  fetcher.calls = calls;
  return fetcher;
}

const immediateFetcher = (payload) => {
  const calls = [];
  const fetcher = (url, opts) => {
    calls.push({ url, opts });
    return Promise.resolve(payload);
  };
  fetcher.calls = calls;
  return fetcher;
};

const failingFetcher = () => {
  const calls = [];
  const fetcher = (url, opts) => {
    calls.push({ url, opts });
    return Promise.reject(new Error("offline"));
  };
  fetcher.calls = calls;
  return fetcher;
};

const res = (key, extra = {}) => ({
  key,
  path: `/${key}`,
  maxAgeMs: 5 * MIN,
  validate: (d) => d?.ok === true,
  ...extra,
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function makeStore({ blobs = memoryBlobs(), fetcher = fakeFetcher(), now = () => Date.now(), ...over } = {}) {
  return createStore({ blobs, fetcher, apiBase: "https://api.test/api", now, ...over });
}

test("1. nothing saved: first emit is loading/none, then ready/api; the copy is saved to blobs", async () => {
  const blobs = memoryBlobs();
  const fetcher = immediateFetcher({ ok: true, v: 1 });
  const store = makeStore({ blobs, fetcher });
  const r = res("home.chilanga");
  const emits = [];
  store.subscribe("home.chilanga", (e) => emits.push(e));
  const entry = await store.load(r);
  assert.equal(emits[0].status, "loading");
  assert.equal(emits[0].source, "none");
  assert.equal(entry.status, "ready");
  assert.equal(entry.source, "api");
  assert.equal(entry.data.v, 1);
  assert.deepEqual(await blobs.get("home.chilanga"), { at: entry.fetchedAt, data: { ok: true, v: 1 } });
  assert.equal(fetcher.calls[0].url, "https://api.test/api/home.chilanga");
});

test("2. saved copy: emitted before the fetch resolves with source cache, then api after", async () => {
  const blobs = memoryBlobs();
  await blobs.set("home.chilanga", { at: 100, data: { ok: true, v: "old" } });
  const fetcher = fakeFetcher();
  let now = 400_000;
  const store = makeStore({ blobs, fetcher, now: () => now });
  const emits = [];
  store.subscribe("home.chilanga", (e) => emits.push(e));
  const p = store.load(res("home.chilanga"));
  await sleep(10);
  assert.equal(store.peek("home.chilanga").source, "cache");
  assert.equal(store.peek("home.chilanga").data.v, "old");
  assert.equal(store.peek("home.chilanga").status, "refreshing"); // fetch in flight
  fetcher.calls[0].resolve({ ok: true, v: "new" });
  const entry = await p;
  assert.equal(entry.source, "api");
  assert.equal(entry.data.v, "new");
  assert.ok(emits.some((e) => e.source === "cache" && e.status === "ready"));
});

test("3. saved copy younger than maxAgeMs: no fetch at all", async () => {
  const blobs = memoryBlobs();
  let now = 1000;
  await blobs.set("home.chilanga", { at: 900, data: { ok: true } });
  const fetcher = fakeFetcher();
  const store = makeStore({ blobs, fetcher, now: () => now });
  const entry = await store.load(res("home.chilanga", { maxAgeMs: 5 * MIN }));
  assert.equal(fetcher.calls.length, 0);
  assert.equal(entry.source, "cache");
  assert.equal(entry.status, "ready");
});

test("4. force: true fetches even when the copy is fresh", async () => {
  const blobs = memoryBlobs();
  let now = 1000;
  await blobs.set("home.chilanga", { at: 999, data: { ok: true } });
  const fetcher = immediateFetcher({ ok: true, v: 2 });
  const store = makeStore({ blobs, fetcher, now: () => now });
  const entry = await store.load(res("home.chilanga"), { force: true });
  assert.equal(fetcher.calls.length, 1);
  assert.equal(entry.source, "api");
  assert.equal(entry.data.v, 2);
});

test("5. two load() calls at once make one fetch (de-duplication)", async () => {
  const fetcher = fakeFetcher();
  const store = makeStore({ fetcher });
  const r = res("home.chilanga");
  const p1 = store.load(r);
  const p2 = store.load(r);
  await sleep(10);
  assert.equal(fetcher.calls.length, 1);
  assert.equal(p1, p2); // same promise
  fetcher.calls[0].resolve({ ok: true });
  await Promise.all([p1, p2]);
  assert.equal(store.peek("home.chilanga").source, "api");
});

test("6. failure with a saved copy: data kept, source cache, error unreachable", async () => {
  const blobs = memoryBlobs();
  await blobs.set("home.chilanga", { at: 5, data: { ok: true, v: "saved" } });
  const store = makeStore({ blobs, fetcher: failingFetcher(), now: () => 10_000_000 });
  const entry = await store.load(res("home.chilanga"));
  assert.equal(entry.source, "cache");
  assert.equal(entry.status, "ready");
  assert.equal(entry.error, "unreachable");
  assert.equal(entry.data.v, "saved");
});

test("7. failure with nothing saved: source offline, error unreachable", async () => {
  const store = makeStore({ fetcher: failingFetcher() });
  const entry = await store.load(res("home.chilanga"));
  assert.equal(entry.source, "offline");
  assert.equal(entry.status, "ready");
  assert.equal(entry.error, "unreachable");
  assert.equal(entry.data, null);
  assert.equal(entry.fetchedAt, null);
});

test("8. validate false is a failure, and the saved copy is not overwritten", async () => {
  const blobs = memoryBlobs();
  await blobs.set("home.chilanga", { at: 5, data: { ok: true, v: "saved" } });
  const fetcher = immediateFetcher({ ok: false }); // fails validate
  const store = makeStore({ blobs, fetcher, now: () => 10_000_000 });
  const entry = await store.load(res("home.chilanga"));
  assert.equal(entry.error, "unreachable");
  assert.equal(entry.data.v, "saved");
  assert.deepEqual(await blobs.get("home.chilanga"), { at: 5, data: { ok: true, v: "saved" } });
});

test("9. timeouts: cold when nothing is saved, warm when a copy is on screen", async () => {
  const fetcher = fakeFetcher();
  const store = makeStore({ fetcher, coldTimeoutMs: 25000, warmTimeoutMs: 15000 });
  const p = store.load(res("home.a"));
  await sleep(5);
  assert.equal(fetcher.calls[0].opts.timeoutMs, 25000);
  fetcher.calls[0].resolve({ ok: true });
  await p;
  const blobs2 = memoryBlobs();
  await blobs2.set("home.b", { at: 1, data: { ok: true } });
  const store2 = makeStore({ blobs: blobs2, fetcher, now: () => 10_000_000 });
  const p2 = store2.load(res("home.b"));
  await sleep(5);
  assert.equal(fetcher.calls[1].opts.timeoutMs, 15000);
  fetcher.calls[1].resolve({ ok: true });
  await p2;
});

test("10. slow hint: after slowAfterMs with nothing on screen, error becomes slow", async () => {
  const fetcher = fakeFetcher(); // never resolves
  const store = makeStore({ fetcher, slowAfterMs: 10 });
  const p = store.load(res("home.chilanga"));
  await sleep(40);
  const entry = store.peek("home.chilanga");
  assert.equal(entry.status, "loading");
  assert.equal(entry.error, "slow");
  fetcher.calls[0].reject(new Error("late failure"));
  const done = await p;
  assert.equal(done.source, "offline");
  assert.equal(done.error, "unreachable");
});

test("11. two keys: a late answer for a never changes b", async () => {
  const fetcher = fakeFetcher();
  const store = makeStore({ fetcher });
  const pa = store.load(res("home.a"));
  const pb = store.load(res("home.b"));
  await sleep(10);
  fetcher.calls.find((c) => c.url.endsWith("/home.b")).resolve({ ok: true, v: "B" });
  await pb;
  const bEntry = store.peek("home.b");
  assert.equal(bEntry.data.v, "B");
  assert.equal(bEntry.source, "api");
  fetcher.calls.find((c) => c.url.endsWith("/home.a")).resolve({ ok: true, v: "A" });
  await pa;
  assert.equal(store.peek("home.b"), bEntry); // untouched, same object
  assert.equal(store.peek("home.b").data.v, "B");
  assert.equal(store.peek("home.a").data.v, "A");
});

test("12. refreshWatched reloads only subscribed keys, and only stale ones", async () => {
  let now = 1000;
  const fetcher = immediateFetcher({ ok: true });
  const store = makeStore({ fetcher, now: () => now });
  await store.load(res("home.a", { maxAgeMs: 100 }));
  await store.load(res("home.b", { maxAgeMs: 100_000 }));
  assert.equal(fetcher.calls.length, 2);
  store.subscribe("home.a", () => {});
  now = 2000; // home.a is now stale, home.b is not
  await store.refreshWatched();
  assert.equal(fetcher.calls.length, 3);
  assert.ok(fetcher.calls[2].url.endsWith("/home.a"));
});

test("13. peek returns the same object between changes and a new object after each change", async () => {
  const fetcher = immediateFetcher({ ok: true });
  const store = makeStore({ fetcher });
  await store.load(res("home.chilanga"));
  const a = store.peek("home.chilanga");
  const b = store.peek("home.chilanga");
  assert.equal(a, b);
  await store.load(res("home.chilanga"), { force: true });
  const c = store.peek("home.chilanga");
  assert.notEqual(a, c);
  assert.equal(store.peek("home.chilanga"), c);
});
