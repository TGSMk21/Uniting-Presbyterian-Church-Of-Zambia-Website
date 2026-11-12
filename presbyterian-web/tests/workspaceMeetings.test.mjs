import { test } from "node:test";
import assert from "node:assert/strict";
import {
  RESPONSES, dayKey, groupByDay, meetingFromForm, meetingWhen, monthGrid, monthRange, parseMonth, parsePlace,
  placeOptions, shiftMonth, zambiaTime, formValues, attendeeCounts,
} from "../Utilities/meetings.mjs";

function form(values) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.append(key, value);
  return data;
}

const GOOD = {
  title: "  Session meeting ", place: "branch:kabwata", date: "2026-11-20", start: "14:00", end: "16:30",
  venue: "Church hall", online_link: "", agenda: "1. Prayer", attendees: "[4, 9]",
};

test("a date and time in Zambia become one exact moment", () => {
  assert.equal(zambiaTime("2026-11-20", "14:00"), "2026-11-20T14:00:00+02:00");
  assert.equal(zambiaTime("2026-13-20", "14:00"), null);
  assert.equal(zambiaTime("2026-11-20", "25:00"), null);
  assert.equal(zambiaTime("", "14:00"), null);
});

test("the day a moment falls on is Zambia's day", () => {
  assert.equal(dayKey("2026-11-20T23:30:00Z"), "2026-11-21");
  assert.equal(dayKey("2026-11-20T10:00:00+02:00"), "2026-11-20");
});

test("the places someone may plan for become plain choices", () => {
  const options = placeOptions({
    branches: [{ slug: "kabwata", name: "Kabwata" }],
    presbyteries: [{ slug: "munali", name: "Munali" }],
    synod: true,
  });
  assert.deepEqual(options.map((o) => [o.value, o.label]), [
    ["branch:kabwata", "Kabwata"], ["presbytery:munali", "Munali Presbytery"], ["synod", "Synod of Zambia"],
  ]);
  assert.deepEqual(placeOptions(null), []);
  assert.deepEqual(parsePlace("presbytery:munali"), { level: "presbytery", presbytery: "munali" });
  assert.deepEqual(parsePlace("branch:kabwata"), { level: "branch", branch: "kabwata" });
  assert.deepEqual(parsePlace("synod"), { level: "synod" });
  assert.equal(parsePlace("branch:../x"), null);
  assert.equal(parsePlace("national:x"), null);
});

test("a new meeting's form becomes the API's body", () => {
  const { body, error } = meetingFromForm(form(GOOD));
  assert.equal(error, undefined);
  assert.deepEqual(body, {
    title: "Session meeting", level: "branch", branch: "kabwata", starts_at: "2026-11-20T14:00:00+02:00",
    ends_at: "2026-11-20T16:30:00+02:00", venue: "Church hall", online_link: "", agenda: "1. Prayer", attendees: [4, 9],
  });
});

test("an edited meeting sends no place or people", () => {
  const { body } = meetingFromForm(form(GOOD), { editing: true });
  assert.equal("level" in body, false);
  assert.equal("branch" in body, false);
  assert.equal("attendees" in body, false);
});

test("the form explains what's missing in plain words", () => {
  assert.match(meetingFromForm(form({ ...GOOD, title: " " })).error, /name/i);
  assert.match(meetingFromForm(form({ ...GOOD, place: "" })).error, /for/i);
  assert.match(meetingFromForm(form({ ...GOOD, date: "" })).error, /date/i);
  assert.match(meetingFromForm(form({ ...GOOD, end: "13:00" })).error, /end after/i);
  assert.match(meetingFromForm(form({ ...GOOD, online_link: "http://x.org" })).error, /https/i);
  assert.equal(meetingFromForm(form({ ...GOOD, end: "" })).body.ends_at, null);
  assert.deepEqual(meetingFromForm(form({ ...GOOD, attendees: "nonsense" })).body.attendees, []);
  assert.deepEqual(meetingFromForm(form({ ...GOOD, attendees: '[1, "x", -3, 1]' })).body.attendees, [1]);
});

test("an existing meeting fills the form back in Zambian time", () => {
  assert.deepEqual(formValues({ starts_at: "2026-11-20T12:00:00Z", ends_at: "2026-11-20T14:30:00Z" }),
    { date: "2026-11-20", start: "14:00", end: "16:30" });
  assert.deepEqual(formValues({ starts_at: "2026-11-20T12:00:00Z", ends_at: null }),
    { date: "2026-11-20", start: "14:00", end: "" });
});

test("a meeting's time reads plainly", () => {
  assert.equal(meetingWhen({ starts_at: "2026-11-20T12:00:00Z", ends_at: "2026-11-20T14:30:00Z" }),
    "Fri 20 Nov, 14:00 to 16:30");
  assert.equal(meetingWhen({ starts_at: "2026-11-20T12:00:00Z", ends_at: null }), "Fri 20 Nov, 14:00");
});

test("months are read safely and stepped through", () => {
  assert.deepEqual(parseMonth("2026-02", new Date("2026-11-12T10:00:00Z")), { year: 2026, month: 2 });
  assert.deepEqual(parseMonth("2026-13", new Date("2026-11-12T10:00:00Z")), { year: 2026, month: 11 });
  assert.deepEqual(parseMonth(undefined, new Date("2026-11-12T10:00:00Z")), { year: 2026, month: 11 });
  assert.deepEqual(shiftMonth({ year: 2026, month: 12 }, 1), { year: 2027, month: 1 });
  assert.deepEqual(shiftMonth({ year: 2026, month: 1 }, -1), { year: 2025, month: 12 });
  assert.deepEqual(monthRange({ year: 2026, month: 2 }), { from: "2026-02-01", to: "2026-02-28" });
});

test("the month grid starts on Monday and fills whole weeks", () => {
  const weeks = monthGrid({ year: 2026, month: 11 });
  assert.equal(weeks[0][0].key, "2026-10-26");
  assert.equal(weeks[0][6].key, "2026-11-01");
  assert.equal(weeks[0][0].inMonth, false);
  assert.equal(weeks[0][6].inMonth, true);
  assert.ok(weeks.every((week) => week.length === 7));
  assert.equal(weeks.at(-1).at(-1).key, "2026-12-06");
});

test("meetings group by day for the agenda list", () => {
  const groups = groupByDay([
    { id: 1, starts_at: "2026-11-20T08:00:00Z" },
    { id: 2, starts_at: "2026-11-20T12:00:00Z" },
    { id: 3, starts_at: "2026-11-22T12:00:00Z" },
  ]);
  assert.deepEqual(groups.map((g) => [g.key, g.meetings.map((m) => m.id)]), [["2026-11-20", [1, 2]], ["2026-11-22", [3]]]);
  assert.equal(groups[0].label, "Friday 20 November");
});

test("replies are counted for the organiser", () => {
  assert.deepEqual(attendeeCounts([{ response: "attending" }, { response: "apologies" }, { response: "pending" },
    { response: "attending" }]), { attending: 2, apologies: 1, pending: 1 });
  assert.equal(RESPONSES.apologies, "Sending apologies");
});

import { readFileSync } from "node:fs";
import { navGroups } from "../Utilities/dashboardNav.mjs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("workspace members find Meetings first in the Workspace menu", () => {
  const items = (staff) => (navGroups(staff).find((g) => g.label === "Workspace")?.items ?? []).map((i) => i.href);
  assert.deepEqual(items({ role: "elder", workspace_member: true }), ["/dashboard/meetings", "/dashboard/structure"]);
  assert.deepEqual(items({ role: "content_editor", workspace_member: false }), []);
});

test("the meeting pages and actions use the workspace meeting addresses", () => {
  const actions = read("app/dashboard/workspace-actions.js");
  for (const path of ["/workspace/meetings/", "\"cancel\"", "respond", "attendees", "attendance", "copy",
    "/workspace/meetings/groups/", "/workspace/calendar-feed/"]) {
    assert.ok(actions.includes(path), path);
  }
  const feed = read("app/calendar/[file]/route.js");
  assert.match(feed, /A-Za-z0-9_-\]\{20,64\}/);
  assert.match(feed, /no-store/);
});
