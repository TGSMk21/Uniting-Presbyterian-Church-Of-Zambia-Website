// The public Projects & Activities page (owner's request, 2026-11-08). Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";

import { activityItem, projectItem, splitActivities } from "../Utilities/projectItems.mjs";

const photo = (id) => ({ id, url: `https://cdn.example/${id}.webp` });

test("a project becomes a card and overlay with plain labels", () => {
  const item = projectItem({
    id: 12, title: "Church roof", status: "ONGOING", progress: 40, description: "New iron sheets.\n\nPhase two.",
    start_date: "2026-01-10", end_date: "2026-06-30", photos: [photo(3), photo(4)],
  });
  assert.equal(item.key, "project-12");
  assert.equal(item.kind, "Project");
  assert.deepEqual(item.status, { text: "In progress", tone: "ongoing" });
  assert.equal(item.progress, 40);
  assert.equal(item.when, "Jan 2026 – Jun 2026");
  assert.deepEqual(item.photos.map((p) => p.url), ["https://cdn.example/3.webp", "https://cdn.example/4.webp"]);
  assert.equal(item.cover, "https://cdn.example/3.webp");
  assert.deepEqual(item.paragraphs, ["New iron sheets.", "Phase two."]);
});

test("progress is kept within 0–100, and a project without photos has no cover", () => {
  assert.equal(projectItem({ id: 1, title: "T", status: "PENDING", progress: 140, description: "", start_date: "2026-01-01", photos: [] }).progress, 100);
  const item = projectItem({ id: 1, title: "T", status: "COMPLETED", progress: -5, description: "", start_date: "2026-01-01" });
  assert.equal(item.progress, 0);
  assert.equal(item.cover, null);
  assert.deepEqual(item.status, { text: "Finished", tone: "done" });
  assert.equal(item.when, "From Jan 2026");
});

test("an activity says its day, time and place", () => {
  const item = activityItem({
    id: 7, title: "Youth Rally", date: "2026-11-21", start_time: "09:00:00", end_time: "12:30:00",
    location: "Church grounds", details: "Games and lunch.", photos: [],
  });
  assert.equal(item.key, "activity-7");
  assert.equal(item.kind, "Activity");
  assert.deepEqual(item.day, { number: "21", month: "Nov", weekday: "Saturday" });
  assert.equal(item.when, "Saturday 21 November 2026");
  assert.equal(item.time, "9:00 AM – 12:30 PM");
  assert.equal(item.location, "Church grounds");
});

test("activities split into coming up (soonest first) and past (latest first), by the day in Zambia", () => {
  const now = new Date("2026-11-08T23:30:00Z"); // already the 9th in Zambia
  const make = (id, date) => ({ id, title: `A${id}`, date, start_time: "09:00", end_time: "10:00", location: "", details: "" });
  const { upcoming, past } = splitActivities([make(1, "2026-11-30"), make(2, "2026-11-08"), make(3, "2026-11-09"), make(4, "2026-10-01")], now);
  assert.deepEqual(upcoming.map((a) => a.key), ["activity-3", "activity-1"]);
  assert.deepEqual(past.map((a) => a.key), ["activity-2", "activity-4"]);
});

test("the home page's glimpse: upcoming activities first, then projects in progress, three at most", async () => {
  const { glimpseItems } = await import("../Utilities/projectItems.mjs");
  const now = new Date("2026-11-08T08:00:00Z");
  const act = (id, date) => ({ id, title: `A${id}`, date, start_time: "09:00", end_time: "10:00", location: "", details: "" });
  const proj = (id, status) => ({ id, title: `P${id}`, status, progress: 10, description: "", start_date: "2026-01-01" });
  const pick = (projects, activities) => glimpseItems(projects, activities, now).map((item) => item.key);
  assert.deepEqual(pick([proj(1, "ONGOING")], [act(2, "2026-12-01"), act(3, "2026-11-10"), act(4, "2026-10-01")]),
    ["activity-3", "activity-2", "project-1"]);
  assert.deepEqual(pick([proj(1, "COMPLETED"), proj(2, "ONGOING"), proj(3, "PENDING")], []), ["project-2", "project-3", "project-1"]);
  assert.deepEqual(pick([], [act(4, "2026-10-01")]), []);
  assert.equal(pick([proj(1, "ONGOING"), proj(2, "ONGOING")], [act(5, "2026-11-20"), act(6, "2026-11-21"), act(7, "2026-11-22")]).length, 3);
});

test("the branch home page shows the glimpse with a link to each one and to the page", async () => {
  const { readFileSync } = await import("node:fs");
  const home = readFileSync(new URL("../app/[branch]/page.js", import.meta.url), "utf8");
  assert.match(home, /glimpseItems\(/);
  assert.match(home, /projects-and-activities#\$\{item\.key\}/);
  assert.match(home, /f\.glimpse_button/);
});
