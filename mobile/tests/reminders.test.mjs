import { test } from "node:test";
import assert from "node:assert/strict";
import { reminderIds, reminderPlan } from "../src/lib/reminders.js";

const EVENT = {
  id: 7, title: "Harvest service", date: "2026-11-24",
  start_time: "10:00:00", end_time: "12:00:00", location: "Main Church",
};

test("reminder ids are deterministic per event", () => {
  assert.deepEqual(reminderIds(7), ["upcz-ev7-eve", "upcz-ev7-day"]);
  assert.notDeepEqual(reminderIds(7), reminderIds(8));
});

test("the plan is day-before at 18:00 and day-of at 07:00, in the future only", () => {
  const now = new Date(2026, 10, 20, 9, 0, 0);
  const plan = reminderPlan(EVENT, now);
  assert.equal(plan.length, 2);
  const [eve, day] = plan;
  assert.equal(eve.id, "upcz-ev7-eve");
  assert.equal(eve.at.getFullYear(), 2026);
  assert.equal(eve.at.getMonth(), 10);
  assert.equal(eve.at.getDate(), 23);
  assert.equal(eve.at.getHours(), 18);
  assert.match(eve.body, /Tomorrow at 10:00 · Main Church/);
  assert.equal(day.at.getDate(), 24);
  assert.equal(day.at.getHours(), 7);
  assert.match(day.body, /Today at 10:00/);
});

test("reminders already in the past are dropped", () => {
  const morning = reminderPlan(EVENT, new Date(2026, 10, 24, 8, 0, 0));
  assert.deepEqual(morning.map((p) => p.id), []);
  const dayBefore = reminderPlan(EVENT, new Date(2026, 10, 23, 19, 0, 0));
  assert.deepEqual(dayBefore.map((p) => p.id), ["upcz-ev7-day"]);
  const pastEvent = reminderPlan({ ...EVENT, date: "2026-11-10" }, new Date(2026, 10, 20, 9, 0, 0));
  assert.deepEqual(pastEvent, []);
});

// --- T04: reconcileReminders decides what to cancel / reschedule, per branch only ---
import { reconcileReminders } from "../src/lib/reminders.js";

const ev = (id, date = "2026-11-24", start_time = "10:00:00") => ({ id, title: `E${id}`, date, start_time });
const notif = (id, extra) => ({ id, extra });

test("reconcileReminders cancels a reminder whose event is gone (same branch)", () => {
  const pending = [notif(11, { eventId: "7", branchSlug: "chilanga", date: "2026-11-24", start_time: "10:00:00" })];
  const { cancel, reschedule } = reconcileReminders(pending, [ev(8)], "chilanga");
  assert.deepEqual(cancel, [11]);
  assert.deepEqual(reschedule, []);
});

test("reconcileReminders leaves other branches' reminders and extra-less ones alone", () => {
  const pending = [
    notif(21, { eventId: "7", branchSlug: "kanyama", date: "2026-11-24", start_time: "10:00:00" }),
    notif(22, undefined),
    notif(23, { branchSlug: "chilanga" }),
  ];
  const { cancel, reschedule } = reconcileReminders(pending, [], "chilanga");
  assert.deepEqual(cancel, []);
  assert.deepEqual(reschedule, []);
});

test("reconcileReminders reschedules a changed event once, even with two notifications", () => {
  const pending = [
    notif(31, { eventId: "7", branchSlug: "chilanga", date: "2026-11-24", start_time: "10:00:00" }),
    notif(32, { eventId: "7", branchSlug: "chilanga", date: "2026-11-24", start_time: "10:00:00" }),
  ];
  const changed = ev(7, "2026-11-25", "10:00:00"); // date moved
  const { cancel, reschedule } = reconcileReminders(pending, [changed], "chilanga");
  assert.deepEqual(cancel, []);
  assert.deepEqual(reschedule, [changed]);
});

test("reconcileReminders does nothing when everything matches", () => {
  const pending = [
    notif(41, { eventId: "7", branchSlug: "chilanga", date: "2026-11-24", start_time: "10:00:00" }),
    notif(42, { eventId: "8", branchSlug: "chilanga", date: "2026-11-26", start_time: "09:00:00" }),
  ];
  const { cancel, reschedule } = reconcileReminders(pending, [ev(7), ev(8, "2026-11-26", "09:00:00")], "chilanga");
  assert.deepEqual(cancel, []);
  assert.deepEqual(reschedule, []);
});
