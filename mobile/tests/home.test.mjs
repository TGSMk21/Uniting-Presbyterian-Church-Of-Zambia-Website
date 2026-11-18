import { test } from "node:test";
import assert from "node:assert/strict";
import { memoryPrefs } from "../src/lib/storage.js";
import { homeKey, homeSlots, loadHome, timeAgo } from "../src/lib/home.js";

const okFetch = (payload) => () => Promise.resolve({ ok: true, json: () => Promise.resolve(payload) });
const failFetch = () => () => Promise.reject(new Error("offline"));

const HOME = {
  branch: { slug: "chilanga", name: "Chilanga" },
  date: "2026-11-18",
  verse: { text: "The Lord is my shepherd", ref: "Psalm 23:1" },
  daily_message: { id: 1, title: "Grace", message: "A short devotion.", reference_verse: "John 1:16" },
  live: null,
  sermons: [{ video_id: "v1", title: "S1", reference_verse: "", preached_at: "2026-11-17T10:00:00Z", duration: "" }],
  events: [{ id: 3, title: "Today fair", date: "2026-11-18", start_time: "14:00:00", end_time: "16:00:00", location: "Hall" }],
};

test("timeAgo in plain words", () => {
  const now = Date.parse("2026-11-18T12:00:00Z");
  assert.equal(timeAgo(now, now), "just now");
  assert.equal(timeAgo(now - 60_000, now), "1 minute ago");
  assert.equal(timeAgo(now - 5 * 60_000, now), "5 minutes ago");
  assert.equal(timeAgo(now - 60 * 60_000, now), "1 hour ago");
  assert.equal(timeAgo(now - 2 * 3600_000, now), "2 hours ago");
  assert.equal(timeAgo(now - 26 * 3600_000, now), "yesterday");
  assert.equal(timeAgo(now - 3 * 86400_000, now), "3 days ago");
  assert.equal(timeAgo(now - 30 * 86400_000, now), "19 October 2026");
});

test("the home layout order is rules, not hard-coded: greeting, live, today, verse, message, sermons, events", () => {
  assert.deepEqual(homeSlots(HOME), ["greeting", "today-event", "verse", "message", "sermons", "events"]);
  const withLive = { ...HOME, live: { video_id: "lv", title: "Live", reference_verse: "", preached_at: "", duration: "" } };
  assert.deepEqual(homeSlots(withLive), ["greeting", "live", "today-event", "verse", "message", "sermons", "events"]);
  assert.deepEqual(homeSlots({}), ["greeting"]);
  assert.deepEqual(homeSlots(null), ["greeting"]);
  const noVerse = { ...HOME, verse: null, daily_message: null, sermons: [], events: [] };
  assert.deepEqual(homeSlots(noVerse), ["greeting"]);
});

test("home cache is per branch", () => {
  assert.equal(homeKey("chilanga"), "upcz.home.chilanga");
  assert.notEqual(homeKey("chilanga"), homeKey("kanyama"));
});

test("no branch means no request and no data", async () => {
  let called = false;
  const result = await loadHome({
    prefs: memoryPrefs(), branchSlug: "",
    fetchImpl: () => { called = true; return Promise.reject(new Error("no")); }, timeoutMs: 20,
  });
  assert.equal(called, false);
  assert.deepEqual(result, { data: null, source: "none", fetchedAt: null });
});

test("a good answer comes from the API and is cached under the branch", async () => {
  const prefs = memoryPrefs();
  const result = await loadHome({ prefs, branchSlug: "chilanga", fetchImpl: okFetch(HOME), timeoutMs: 50 });
  assert.equal(result.source, "api");
  assert.equal(result.data.branch.slug, "chilanga");
  const cached = JSON.parse(prefs.store[homeKey("chilanga")]);
  assert.deepEqual(cached.data, HOME);
  assert.ok(cached.at > 0);
});

test("an answer for a different branch is refused", async () => {
  const prefs = memoryPrefs();
  const wrong = { ...HOME, branch: { slug: "kanyama", name: "Kanyama" } };
  const result = await loadHome({ prefs, branchSlug: "chilanga", fetchImpl: okFetch(wrong), timeoutMs: 50 });
  assert.equal(result.source, "offline");
  assert.equal(result.data, null);
});

test("offline, the cached home of that branch is used; with nothing cached, source is offline", async () => {
  const prefs = memoryPrefs();
  prefs.store[homeKey("chilanga")] = JSON.stringify({ at: 123, data: HOME });
  const cached = await loadHome({ prefs, branchSlug: "chilanga", fetchImpl: failFetch(), timeoutMs: 20 });
  assert.equal(cached.source, "cache");
  assert.deepEqual(cached.data, HOME);
  assert.equal(cached.fetchedAt, 123);
  const empty = await loadHome({ prefs: memoryPrefs(), branchSlug: "kanyama", fetchImpl: failFetch(), timeoutMs: 20 });
  assert.deepEqual(empty, { data: null, source: "offline", fetchedAt: null });
});

test("a hanging request times out and falls back to the cache", async () => {
  const prefs = memoryPrefs();
  prefs.store[homeKey("chilanga")] = JSON.stringify({ at: 5, data: HOME });
  const result = await loadHome({
    prefs, branchSlug: "chilanga", timeoutMs: 25,
    fetchImpl: () => new Promise(() => {}),
  });
  assert.equal(result.source, "cache");
});

test("a non-200 or malformed answer is a failure, not a crash", async () => {
  for (const fetchImpl of [
    () => Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({}) }),
    () => Promise.resolve({ ok: true, json: () => Promise.reject(new Error("bad json")) }),
    () => Promise.resolve({ ok: true, json: () => Promise.resolve(null) }),
  ]) {
    const result = await loadHome({ prefs: memoryPrefs(), branchSlug: "chilanga", fetchImpl, timeoutMs: 20 });
    assert.equal(result.source, "offline");
  }
});
