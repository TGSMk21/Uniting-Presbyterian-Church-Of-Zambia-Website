import { test } from "node:test";
import assert from "node:assert/strict";
import { memoryPrefs, readJSON } from "../src/lib/storage.js";
import { readAdded, toggleAdded, toggleId, writeAdded } from "../src/lib/calendarStore.js";
import { needsBatteryGuide } from "../src/lib/phoneMake.js";

test("toggleId adds and removes, as strings", () => {
  assert.deepEqual(toggleId([], 7), ["7"]);
  assert.deepEqual(toggleId(["7"], 7), []);
  assert.deepEqual(toggleId(["7"], "8"), ["7", "8"]);
});

test("added events persist on the phone and survive a bad stored value", async () => {
  const prefs = memoryPrefs();
  assert.deepEqual(await readAdded(prefs), []);
  let list = await toggleAdded(prefs, 7);
  assert.deepEqual(list, ["7"]);
  list = await toggleAdded(prefs, 8);
  assert.deepEqual(list, ["7", "8"]);
  assert.deepEqual(await readAdded(memoryPrefs({ "upcz.addedEvents": "{oops" })), []);
  prefs.store["upcz.addedEvents"] = JSON.stringify({ nope: true });
  assert.deepEqual(await readAdded(prefs), []);
  await writeAdded(prefs, ["1", "2"]);
  assert.deepEqual(await readAdded(prefs), ["1", "2"]);
});

test("phones that limit background reminders are detected from the user agent", () => {
  assert.equal(needsBatteryGuide("Mozilla/5.0 (Linux; Android 13) Tecno Spark 20"), true);
  assert.equal(needsBatteryGuide("Mozilla/5.0 (Linux; Android 12) INFINIX X6525"), true);
  assert.equal(needsBatteryGuide("Mozilla/5.0 (Linux; Android 14) Xiaomi 2210132C"), true);
  assert.equal(needsBatteryGuide("Mozilla/5.0 (Linux; Android 14) Redmi Note 13"), true);
  assert.equal(needsBatteryGuide("Mozilla/5.0 (Linux; Android 15) Samsung SM-S918B"), false);
  assert.equal(needsBatteryGuide("Mozilla/5.0 (Linux; Android 15) Pixel 8"), false);
  assert.equal(needsBatteryGuide(""), false);
});

// --- T03: phone calendar via @capgo/capacitor-calendar (CapacitorCalendar, not Calendar) ---
import { addToPhoneCalendar, eventTimes, removeFromPhoneCalendar } from "../src/lib/calendarStore.js";

function fakePlugin({ perm = "granted", afterRequest = "granted", createId = "77", throwOnCreate = false } = {}) {
  const calls = [];
  return {
    calls,
    checkPermission: async (opts) => { calls.push(["check", opts]); return { result: perm }; },
    requestFullCalendarAccess: async () => { calls.push(["request"]); return { result: afterRequest }; },
    createEvent: async (opts) => { calls.push(["create", opts]); if (throwOnCreate) throw new Error("x"); return { id: createId }; },
    deleteEvent: async (opts) => { calls.push(["delete", opts]); },
  };
}

const EVENT = { id: 42, title: "Harvest service", date: "2026-11-22", start_time: "10:00:00", end_time: "12:00:00", location: "Church grounds", details: "Bring a chair" };

test("eventTimes reads Zambian time (UTC+02:00 all year)", () => {
  const { start, end } = eventTimes({ date: "2026-11-22", start_time: "10:00:00", end_time: "12:00:00" });
  assert.equal(start, Date.parse("2026-11-22T08:00:00Z"));
  assert.equal(end, Date.parse("2026-11-22T10:00:00Z"));
});

test("eventTimes: missing/invalid end is start + 1h; missing start is 09:00", () => {
  const base = eventTimes({ date: "2026-11-22", start_time: "10:00:00" });
  assert.equal(base.end, base.start + 60 * 60 * 1000);
  const backwards = eventTimes({ date: "2026-11-22", start_time: "10:00:00", end_time: "09:00:00" });
  assert.equal(backwards.end, backwards.start + 60 * 60 * 1000);
  const noStart = eventTimes({ date: "2026-11-22" });
  assert.equal(noStart.start, Date.parse("2026-11-22T07:00:00Z")); // 09:00 in Zambia
});

test("addToPhoneCalendar with granted permission creates a numeric-ms event with description and stores the id", async () => {
  const prefs = memoryPrefs();
  const plugin = fakePlugin();
  const outcome = await addToPhoneCalendar(EVENT, prefs, { plugin, native: true });
  assert.equal(outcome, "added");
  const create = plugin.calls.find(([name]) => name === "create");
  assert.ok(create, "createEvent was called");
  const opts = create[1];
  assert.equal(typeof opts.startDate, "number");
  assert.equal(typeof opts.endDate, "number");
  assert.equal(opts.startDate, Date.parse("2026-11-22T08:00:00Z"));
  assert.equal(opts.endDate, Date.parse("2026-11-22T10:00:00Z"));
  assert.equal(opts.description, "Bring a chair");
  assert.equal("notes" in opts, false);
  assert.equal(opts.title, "Harvest service");
  assert.equal(opts.location, "Church grounds");
  assert.equal(await readJSON(prefs, "upcz.cal.42", null), "77");
  const check = plugin.calls.find(([name]) => name === "check");
  assert.equal(check[1].scope, "writeCalendar");
});

test("addToPhoneCalendar: prompt then denied returns denied, no create, nothing stored", async () => {
  const prefs = memoryPrefs();
  const plugin = fakePlugin({ perm: "prompt", afterRequest: "denied" });
  const outcome = await addToPhoneCalendar(EVENT, prefs, { plugin, native: true });
  assert.equal(outcome, "denied");
  assert.equal(plugin.calls.some(([name]) => name === "create"), false);
  assert.equal(await readJSON(prefs, "upcz.cal.42", null), null);
  assert.ok(plugin.calls.some(([name]) => name === "request"));
});

test("addToPhoneCalendar: createEvent throwing returns failed", async () => {
  const prefs = memoryPrefs();
  const plugin = fakePlugin({ throwOnCreate: true });
  const outcome = await addToPhoneCalendar(EVENT, prefs, { plugin, native: true });
  assert.equal(outcome, "failed");
  assert.equal(await readJSON(prefs, "upcz.cal.42", null), null);
});

test("addToPhoneCalendar on a non-native platform returns unavailable and touches no plugin", async () => {
  const plugin = fakePlugin();
  const outcome = await addToPhoneCalendar(EVENT, memoryPrefs(), { plugin, native: false });
  assert.equal(outcome, "unavailable");
  assert.equal(plugin.calls.length, 0);
});

test("removeFromPhoneCalendar deletes the stored entry and always forgets the key", async () => {
  const prefs = memoryPrefs({ "upcz.cal.42": JSON.stringify("77") });
  const plugin = fakePlugin();
  await removeFromPhoneCalendar(EVENT, prefs, { plugin, native: true });
  assert.deepEqual(plugin.calls, [["delete", { id: "77" }]]);
  assert.equal(await readJSON(prefs, "upcz.cal.42", null), null);

  // deleteEvent throwing still forgets the key
  const prefs2 = memoryPrefs({ "upcz.cal.42": JSON.stringify("77") });
  const badPlugin = fakePlugin();
  badPlugin.deleteEvent = async () => { throw new Error("already deleted"); };
  await removeFromPhoneCalendar(EVENT, prefs2, { plugin: badPlugin, native: true });
  assert.equal(await readJSON(prefs2, "upcz.cal.42", null), null);
});
