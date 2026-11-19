import { test } from "node:test";
import assert from "node:assert/strict";
import { memoryPrefs } from "../src/lib/storage.js";
import { filterHymns, loadHymnCollections, loadHymns, sortHymns } from "../src/lib/hymns.js";

const okFetch = (payload) => () => Promise.resolve({ ok: true, json: () => Promise.resolve(payload) });
const failFetch = () => () => Promise.reject(new Error("offline"));

const COLLECTIONS = {
  collections: [
    { collection: "tumbuka", label: "Tumbuka Hymns", count: 2 },
    { collection: "chewa", label: "Chewa Hymns", count: 0 },
    { collection: "english", label: "English Hymns", count: 1 },
  ],
};
const ENGLISH = {
  collection: "english",
  hymns: [
    { id: 2, collection: "english", number: 2, title: "Rock of Ages", verses: ["v1"], chorus: "c", notes: "" },
    { id: 1, collection: "english", number: 1, title: "Amazing Grace", verses: ["a", "b"], chorus: "", notes: "1779" },
  ],
};

test("collections load and cache globally (church-wide, no branch); bad payload refused", async () => {
  const prefs = memoryPrefs();
  const api = await loadHymnCollections({ prefs, fetchImpl: okFetch(COLLECTIONS), timeoutMs: 50 });
  assert.equal(api.source, "api");
  assert.equal(api.data.collections.length, 3);
  assert.ok(prefs.store["upcz.hymnCollections"]);
  const cached = await loadHymnCollections({ prefs, fetchImpl: failFetch(), timeoutMs: 20 });
  assert.equal(cached.source, "cache");
  assert.equal(cached.data.collections[0].label, "Tumbuka Hymns");
  const bad = await loadHymnCollections({ prefs: memoryPrefs(), fetchImpl: okFetch({ nope: 1 }), timeoutMs: 20 });
  assert.equal(bad.source, "offline");
  const empty = await loadHymnCollections({ prefs: memoryPrefs(), fetchImpl: failFetch(), timeoutMs: 20 });
  assert.deepEqual(empty, { data: null, source: "offline", fetchedAt: null });
});

test("a collection downloads fully for offline and caches per collection; wrong collection refused", async () => {
  const prefs = memoryPrefs();
  const api = await loadHymns({ prefs, collection: "english", fetchImpl: okFetch(ENGLISH), timeoutMs: 50 });
  assert.equal(api.source, "api");
  assert.equal(api.data.hymns.length, 2);
  assert.ok(prefs.store["upcz.hymns.english"]);
  assert.equal(prefs.store["upcz.hymns.tumbuka"], undefined);
  const cached = await loadHymns({ prefs, collection: "english", fetchImpl: failFetch(), timeoutMs: 20 });
  assert.equal(cached.source, "cache");
  assert.equal(cached.data.hymns[0].title, "Rock of Ages");
  const wrong = await loadHymns({
    prefs: memoryPrefs(), collection: "english", timeoutMs: 20,
    fetchImpl: okFetch({ ...ENGLISH, collection: "tumbuka" }),
  });
  assert.equal(wrong.source, "offline");
});

test("search matches title or number; list sorts by number then title", () => {
  const hymns = ENGLISH.hymns;
  assert.deepEqual(filterHymns(hymns, "grace").map((h) => h.id), [1]);
  assert.deepEqual(filterHymns(hymns, "2").map((h) => h.id), [2]);
  assert.equal(filterHymns(hymns, "").length, 2);
  assert.deepEqual(filterHymns(hymns, "zzz"), []);
  assert.deepEqual(sortHymns(hymns).map((h) => h.number), [1, 2]);
  assert.deepEqual(sortHymns([{ number: 3, title: "B" }, { number: 3, title: "A" }]).map((h) => h.title), ["A", "B"]);
});
