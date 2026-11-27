import { test } from "node:test";
import assert from "node:assert/strict";
import { memoryPrefs } from "../src/lib/storage.js";
import { markRead, readMarks, unreadCount, unreadOf } from "../src/lib/marks.js";
import { sortAnnouncements } from "../src/lib/announcements.js";
import { announcementsResource } from "../src/lib/resources.js";

const PAYLOAD = {
  branch: { slug: "chilanga", name: "Chilanga" },
  announcements: [
    { id: 1, title: "Plain", body: "b1", starts_on: "2026-11-16", is_pinned: false },
    { id: 2, title: "Pinned", body: "b2", starts_on: "2026-11-17", is_pinned: true },
  ],
};

test("announcementsResource: key, path and validate (wrong branch refused)", () => {
  const r = announcementsResource("chilanga");
  assert.equal(r.key, "announcements.chilanga");
  assert.equal(r.path, "/app/announcements/?branch=chilanga");
  assert.equal(r.maxAgeMs, 5 * 60_000);
  assert.equal(r.validate(PAYLOAD), true);
  assert.equal(r.validate({ ...PAYLOAD, branch: { slug: "kanyama", name: "Kanyama" } }), false);
  assert.equal(r.validate({ branch: { slug: "chilanga" } }), false);
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
