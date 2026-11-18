import { test } from "node:test";
import assert from "node:assert/strict";
import { memoryPrefs } from "../src/lib/storage.js";
import { contentKey, loadAnnouncements } from "../src/lib/content.js";
import { markRead, readMarks, unreadCount, unreadOf } from "../src/lib/marks.js";
import { sortAnnouncements } from "../src/lib/announcements.js";

const okFetch = (payload) => () => Promise.resolve({ ok: true, json: () => Promise.resolve(payload) });
const failFetch = () => () => Promise.reject(new Error("offline"));

const PAYLOAD = {
  branch: { slug: "chilanga", name: "Chilanga" },
  announcements: [
    { id: 1, title: "Plain", body: "b1", starts_on: "2026-11-16", is_pinned: false },
    { id: 2, title: "Pinned", body: "b2", starts_on: "2026-11-17", is_pinned: true },
  ],
};

test("announcements load like the other content: api cached per branch, offline serves cache, wrong branch refused", async () => {
  const prefs = memoryPrefs();
  const api = await loadAnnouncements({ prefs, branchSlug: "chilanga", fetchImpl: okFetch(PAYLOAD), timeoutMs: 50 });
  assert.equal(api.source, "api");
  assert.equal(api.data.announcements.length, 2);
  assert.ok(prefs.store[contentKey("announcements", "chilanga")]);
  const cached = await loadAnnouncements({ prefs, branchSlug: "chilanga", fetchImpl: failFetch(), timeoutMs: 20 });
  assert.equal(cached.source, "cache");
  const offline = await loadAnnouncements({ prefs: memoryPrefs(), branchSlug: "chilanga", fetchImpl: failFetch(), timeoutMs: 20 });
  assert.deepEqual(offline, { data: null, source: "offline", fetchedAt: null });
  const wrong = await loadAnnouncements({
    prefs: memoryPrefs(), branchSlug: "chilanga", timeoutMs: 20,
    fetchImpl: okFetch({ ...PAYLOAD, branch: { slug: "kanyama", name: "Kanyama" } }),
  });
  assert.equal(wrong.source, "offline");
});

test("pinned first, then newest first — regardless of the order the API sent", () => {
  const sorted = sortAnnouncements([
    { id: 1, title: "a", starts_on: "2026-11-10", is_pinned: false },
    { id: 2, title: "p1", starts_on: "2026-11-01", is_pinned: true },
    { id: 3, title: "b", starts_on: "2026-11-15", is_pinned: false },
    { id: 4, title: "p2", starts_on: "2026-11-12", is_pinned: true },
  ]);
  assert.deepEqual(sorted.map((a) => a.title), ["p2", "p1", "b", "a"]);
});

test("read marks: markRead is idempotent, unread count and list follow", async () => {
  const prefs = memoryPrefs();
  assert.equal(unreadCount(PAYLOAD.announcements, await readMarks(prefs, "upcz.readAnnouncements")), 2);
  await markRead(prefs, "upcz.readAnnouncements", 2);
  await markRead(prefs, "upcz.readAnnouncements", 2);
  const marks = await readMarks(prefs, "upcz.readAnnouncements");
  assert.deepEqual(marks, ["2"]);
  assert.equal(unreadCount(PAYLOAD.announcements, marks), 1);
  assert.deepEqual(unreadOf(PAYLOAD.announcements, marks).map((a) => a.id), [1]);
  prefs.store["upcz.readAnnouncements"] = "{oops";
  assert.equal(unreadCount(PAYLOAD.announcements, await readMarks(prefs, "upcz.readAnnouncements")), 2);
});
