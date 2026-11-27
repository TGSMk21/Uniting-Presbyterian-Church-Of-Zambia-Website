import { test } from "node:test";
import assert from "node:assert/strict";
import { homeKey, homeSlots, timeAgo } from "../src/lib/home.js";
import { homeResource } from "../src/lib/resources.js";

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

test("homeResource: key, path and validate (wrong branch refused)", () => {
  const r = homeResource("chilanga");
  assert.equal(r.key, "home.chilanga");
  assert.equal(r.path, "/app/home/?branch=chilanga");
  assert.equal(r.maxAgeMs, 5 * 60_000);
  assert.equal(r.validate(HOME), true);
  assert.equal(r.validate({ ...HOME, branch: { slug: "kanyama", name: "Kanyama" } }), false);
  assert.equal(r.validate(null), false);
});

test("homeResource encodes the branch in the path", () => {
  assert.equal(homeResource("st-columbus-kabwe").path, "/app/home/?branch=st-columbus-kabwe");
});
