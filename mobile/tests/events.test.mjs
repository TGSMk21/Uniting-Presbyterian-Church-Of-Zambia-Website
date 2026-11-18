import { test } from "node:test";
import assert from "node:assert/strict";
import { memoryPrefs } from "../src/lib/storage.js";
import { contentKey } from "../src/lib/content.js";
import {
  dotsFor, eventLabel, eventsOnDate, formatTime, loadEvents, monthGrid, pastEvents,
  sortRecentFirst, todayIso, upcoming,
} from "../src/lib/events.js";

const okFetch = (payload) => () => Promise.resolve({ ok: true, json: () => Promise.resolve(payload) });
const failFetch = () => () => Promise.reject(new Error("offline"));

const EVENTS = {
  branch: { slug: "chilanga", name: "Chilanga" },
  events: [
    { id: 1, title: "Past fair", date: "2026-11-10", start_time: "14:00:00", end_time: "16:00:00", location: "Hall", details: "d", photos: [] },
    { id: 2, title: "Today service", date: "2026-11-18", start_time: "10:00:00", end_time: "12:00:00", location: "Church", details: "d", photos: [] },
    { id: 3, title: "Today later", date: "2026-11-18", start_time: "14:00:00", end_time: "15:00:00", location: "Hall", details: "d", photos: [] },
    { id: 4, title: "Next Sunday", date: "2026-11-24", start_time: "10:00:00", end_time: "12:00:00", location: "Church", details: "d", photos: [] },
  ],
};

const TODAY = "2026-11-18";

test("events load like the other content: api cached per branch, offline serves cache, wrong branch refused", async () => {
  const prefs = memoryPrefs();
  const api = await loadEvents({ prefs, branchSlug: "chilanga", fetchImpl: okFetch(EVENTS), timeoutMs: 50 });
  assert.equal(api.source, "api");
  assert.equal(api.data.events.length, 4);
  assert.ok(prefs.store[contentKey("events", "chilanga")]);
  const cached = await loadEvents({ prefs, branchSlug: "chilanga", fetchImpl: failFetch(), timeoutMs: 20 });
  assert.equal(cached.source, "cache");
  assert.equal(cached.data.events.length, 4);
  const offline = await loadEvents({ prefs: memoryPrefs(), branchSlug: "chilanga", fetchImpl: failFetch(), timeoutMs: 20 });
  assert.deepEqual(offline, { data: null, source: "offline", fetchedAt: null });
  const wrong = await loadEvents({
    prefs: memoryPrefs(), branchSlug: "chilanga", timeoutMs: 20,
    fetchImpl: okFetch({ ...EVENTS, branch: { slug: "kanyama", name: "Kanyama" } }),
  });
  assert.equal(wrong.source, "offline");
});

test("most recent first: date descending, then start time descending", () => {
  const sorted = sortRecentFirst(EVENTS.events);
  assert.deepEqual(sorted.map((e) => e.title), ["Next Sunday", "Today later", "Today service", "Past fair"]);
  assert.deepEqual(EVENTS.events.map((e) => e.id), [1, 2, 3, 4]);
});

test("labels: Today, Tomorrow, Past, or the full date", () => {
  assert.equal(eventLabel(EVENTS.events[1], TODAY), "Today");
  assert.equal(eventLabel({ date: "2026-11-19" }, TODAY), "Tomorrow");
  assert.equal(eventLabel(EVENTS.events[0], TODAY), "Past");
  assert.equal(eventLabel(EVENTS.events[3], TODAY), "Tuesday 24 November");
});

test("upcoming and past split at today; eventsOnDate filters", () => {
  assert.deepEqual(upcoming(EVENTS.events, TODAY).map((e) => e.id), [2, 3, 4]);
  assert.deepEqual(pastEvents(EVENTS.events, TODAY).map((e) => e.id), [1]);
  assert.deepEqual(eventsOnDate(EVENTS.events, TODAY).map((e) => e.id), [2, 3]);
});

test("todayIso is the phone's local date", () => {
  assert.match(todayIso(new Date(2026, 10, 18, 23, 30)), /^2026-11-18$/);
});

test("monthGrid is Monday-first, six weeks, November 2026 starts on a Sunday", () => {
  const weeks = monthGrid(2026, 10);
  assert.equal(weeks.length, 6);
  assert.equal(weeks[0].length, 7);
  assert.equal(weeks[0][0].iso, "2026-10-26");
  assert.equal(weeks[0][0].inMonth, false);
  assert.equal(weeks[0][6].iso, "2026-11-01");
  assert.equal(weeks[0][6].inMonth, true);
  const all = weeks.flat();
  assert.equal(all.filter((c) => c.inMonth).length, 30);
  assert.ok(all.some((c) => c.iso === "2026-11-18" && c.inMonth));
});

test("dotsFor marks event days, sermon days and added events", () => {
  const dots = dotsFor({
    events: EVENTS.events,
    sermons: [{ preached_at: "2026-11-18T10:00:00Z" }, { preached_at: "2026-11-01T09:00:00Z" }],
    added: ["2"],
  });
  assert.deepEqual(dots["2026-11-18"], { event: true, added: true, sermon: true });
  assert.deepEqual(dots["2026-11-10"], { event: true, added: false });
  assert.deepEqual(dots["2026-11-01"], { sermon: true });
  assert.equal(dots["2026-11-24"].added, false);
});

test("formatTime trims seconds", () => {
  assert.equal(formatTime("14:00:00"), "14:00");
  assert.equal(formatTime("09:30"), "09:30");
  assert.equal(formatTime(""), "");
});
