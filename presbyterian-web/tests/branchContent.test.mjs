// Sermons, projects and activities in the dashboard (AGENT_EXECUTION_PLAN.md, Task 5.3). Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  BRANCH_LIST_TAG,
  MINISTER_PHOTO,
  NEW_DEFAULTS,
  SECTIONS,
  UPCOMING_ACTIVITIES_TAG,
  apiPath,
  formValues,
  isBranchSlug,
  isRowId,
  manageableBranches,
  rowSummary,
  rowTitle,
  saveFailure,
  section,
  sectionTag,
  submittedValues,
  tagsToClear,
  valuesFromForm,
} from "../Utilities/branchContent.mjs";

function form(entries) {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.append(key, value);
  return data;
}

test("only these sections exist", () => {
  assert.deepEqual(Object.keys(SECTIONS), ["sermons", "projects", "activities", "announcements", "ministers", "services", "messages", "writings"]);
  assert.deepEqual(Object.keys(NEW_DEFAULTS), Object.keys(SECTIONS));
  assert.equal(section("sermons"), SECTIONS.sermons);
  assert.equal(section("toString"), undefined);
  assert.equal(section("pages"), undefined);
});

test("buttons read properly", () => {
  assert.deepEqual(Object.values(SECTIONS).map((s) => s.adding), [
    "Add a sermon", "Add a project", "Add an event", "Add an announcement", "Add a minister", "Add a service time", "Write a daily message",
    "Paste a written sermon",
  ]);
});

test("sermons can't be deleted, because YouTube would bring them back", () => {
  assert.equal(SECTIONS.sermons.canDelete, false);
  assert.equal(SECTIONS.projects.canDelete, true);
  assert.equal(SECTIONS.activities.canDelete, true);
});

test("form limits match the API's", () => {
  const limits = Object.fromEntries(
    Object.entries(SECTIONS).map(([name, { fields }]) => [name, Object.fromEntries(fields.map((f) => [f.key, f.max]))]),
  );
  assert.equal(limits.sermons.title, 300);
  assert.equal(limits.sermons.series, 200);
  assert.equal(limits.sermons.reference_verse, 100);
  assert.equal(limits.sermons.description, 5000);
  assert.equal(limits.projects.progress, 100);
  assert.equal(limits.activities.location, 300);
  assert.equal(limits.ministers.name, 200);
  assert.equal(limits.ministers.bio, 5000);
  assert.equal(limits.ministers.order, 999);
  assert.equal(limits.services.day, 50);
  assert.equal(limits.services.title, 200);
  assert.equal(limits.services.location, 200);
  assert.equal(limits.services.details, 200);
  assert.equal(limits.services.order, 999);
  assert.equal(MINISTER_PHOTO.max_side, 800);
});

test("only safe pieces go into API addresses", () => {
  assert.ok(isBranchSlug("chilanga"));
  assert.ok(isBranchSlug("st-andrews_2"));
  for (const bad of ["", "../auth", "a/b", "a?b", "a b", "x".repeat(51), undefined]) {
    assert.equal(isBranchSlug(bad), false, String(bad));
  }
  assert.ok(isRowId("1"));
  assert.ok(isRowId("1234567890"));
  for (const bad of ["0", "01", "-1", "1.5", "1/", "abc", "", "12345678901", undefined]) {
    assert.equal(isRowId(bad), false, String(bad));
  }
  assert.equal(apiPath("chilanga", "sermons"), "/staff/chilanga/sermons/");
  assert.equal(apiPath("chilanga", "projects", "7"), "/staff/chilanga/projects/7/");
});

test("saving clears the public copy, and activities clear the national list too", () => {
  assert.equal(sectionTag("sermons", "chilanga"), "sermons:chilanga");
  assert.deepEqual(tagsToClear("projects", "chilanga"), ["projects:chilanga"]);
  assert.deepEqual(tagsToClear("activities", "chilanga"), ["activities:chilanga", UPCOMING_ACTIVITIES_TAG]);
  assert.deepEqual(tagsToClear("ministers", "chilanga"), ["ministers:chilanga"]);
  // Service times come with the branch, and with the list in Find a Branch.
  assert.deepEqual(tagsToClear("services", "chilanga"), ["branch:chilanga", BRANCH_LIST_TAG]);
});

test("the public site's requests carry the tags the dashboard clears", () => {
  const source = readFileSync(new URL("../Services/api.js", import.meta.url), "utf8");
  for (const fn of [
    "getSermons", "getSermonByVideoId", "getProjects", "getActivities", "getUpcomingActivities", "getMinisters",
    "getBranches", "getBranch",
  ]) {
    const body = source.slice(source.indexOf(`function ${fn}(`)).split("\n}")[0];
    assert.match(body, /tags:|cachedFor\(/, `${fn} has no cache tag`);
  }
  assert.match(source, /UPCOMING_ACTIVITIES_TAG/);
  assert.match(source, /tags: \[BRANCH_LIST_TAG\]/);
  for (const name of ["sermons", "projects", "activities", "ministers"]) {
    assert.match(source, new RegExp(`sectionTag\\(['"]${name}['"]`), `${name} tag missing`);
  }
});

test("a new sermon sends its link; an edit doesn't", () => {
  const data = form({
    video: " https://youtu.be/dQw4w9WgXcQ ", title: " Grace ", preached_at: "2026-11-08T10:00",
    series: "", reference_verse: "Eph 2:8", description: "Line one\r\nLine two",
  });
  const added = valuesFromForm("sermons", data, { isNew: true });
  assert.deepEqual(added, {
    video: "https://youtu.be/dQw4w9WgXcQ", title: "Grace", preached_at: "2026-11-08T10:00", series: "",
    reference_verse: "Eph 2:8", description: "Line one\nLine two", is_hidden: false,
  });
  const edited = valuesFromForm("sermons", data, { isNew: false });
  assert.equal("video" in edited, false);
});

test("the hide box is sent as true or false", () => {
  assert.equal(valuesFromForm("sermons", form({ is_hidden: "on" }), { isNew: false }).is_hidden, true);
  assert.equal(valuesFromForm("sermons", form({}), { isNew: false }).is_hidden, false);
});

test("an empty end date clears it, and other empty boxes stay empty for the API to check", () => {
  const values = valuesFromForm("projects", form({ title: "", start_date: "", end_date: "" }), { isNew: true });
  assert.equal(values.end_date, null);
  assert.equal(values.start_date, "");
  assert.equal(values.title, "");
});

test("saved values fill the form's boxes", () => {
  const sermon = formValues("sermons", {
    title: "Grace", preached_at: "2026-11-08T10:00:00+02:00", series: "", reference_verse: null, is_hidden: true,
  });
  assert.equal(sermon.preached_at, "2026-11-08T10:00");
  assert.equal(sermon.reference_verse, "");
  assert.equal(sermon.is_hidden, true);
  assert.equal(sermon.video, "");
  const activity = formValues("activities", { start_time: "08:00:00", end_time: "17:30:00" });
  assert.equal(activity.start_time, "08:00");
  assert.equal(activity.end_time, "17:30");
  assert.equal(formValues("projects", { progress: 0, end_date: null }).progress, "0");
});

test("a refused save keeps what was typed", () => {
  const typed = submittedValues("activities", form({ title: "Camp", start_time: "09:00", end_time: "08:00" }));
  assert.deepEqual(typed, {
    title: "Camp", date: "", start_time: "09:00", end_time: "08:00", location: "", details: "",
  });
  assert.equal(submittedValues("sermons", form({ is_hidden: "on" })).is_hidden, true);
});

test("API complaints are shown next to the right box", () => {
  const result = saveFailure("projects", 400, {
    end_date: ["The end date can't be before the start date."], non_field_errors: ["Something else."],
  });
  assert.deepEqual(result, {
    error: "Something else.", fields: { end_date: "The end date can't be before the start date." },
  });
  assert.equal(saveFailure("sermons", 400, { video: ["This video is already in your sermons."] }).error, null);
  assert.deepEqual(saveFailure("sermons", 401), { signedOut: true });
  assert.match(saveFailure("sermons", 403).error, /can't/);
  assert.match(saveFailure("projects", 404).error, /no longer exists/);
  assert.match(saveFailure("projects", 500).error, /Nothing was saved/);
  assert.match(saveFailure("projects", 0).error, /Nothing was saved/);
});

test("list rows say when, and how far along", () => {
  assert.equal(
    rowSummary("sermons", { preached_at: "2026-11-08T23:30:00+02:00", series: "Ephesians" }),
    "8 Nov 2026 · Ephesians",
  );
  assert.equal(rowSummary("projects", { status: "ONGOING", progress: 40 }), "In progress · 40%");
  assert.equal(
    rowSummary("activities", { date: "2026-12-20", start_time: "08:00:00", end_time: "17:00:00", location: "Hall" }),
    "Sun, 20 Dec 2026 · 08:00–17:00 · Hall",
  );
});

test("ministers and service times are listed plainly", () => {
  assert.equal(rowTitle({ name: "Banda" }), "Banda");
  assert.equal(rowTitle({ title: "Roof" }), "Roof");
  assert.equal(rowSummary("ministers", { order: 0, photo: null }), "Order 0 · No photo yet");
  assert.equal(rowSummary("ministers", { order: 2, photo: "https://x/y.webp" }), "Order 2 · Has a photo");
  assert.equal(
    rowSummary("services", { day: "Every Sunday", start_time: "09:00:00", end_time: "11:00:00", location: "" }),
    "Every Sunday · 09:00–11:00",
  );
});

test("a minister's photo can't be typed into the form", () => {
  assert.equal(SECTIONS.ministers.fields.some(({ key }) => key === "photo"), false);
  assert.equal("photo" in valuesFromForm("ministers", form({ name: "Banda", photo: "x.webp", order: "0" }), { isNew: false }), false);
});

test("people manage only the branches the API lets them", () => {
  const branches = [{ slug: "a", name: "A", extra: 1 }, { slug: "b", name: "B" }];
  assert.deepEqual(manageableBranches({ is_superuser: true }, branches), [{ slug: "a", name: "A" }, { slug: "b", name: "B" }]);
  const own = { slug: "a", name: "A" };
  assert.deepEqual(manageableBranches({ role: "content_editor", branch: own }, branches), [own]);
  assert.deepEqual(manageableBranches({ role: "branch_admin", branch: own }, branches), [own]);
  assert.deepEqual(manageableBranches({ role: "finance_admin", branch: own }, branches), []);
  assert.deepEqual(manageableBranches({ role: "super_admin", branch: null }, branches), []);
  assert.deepEqual(manageableBranches({ role: "content_editor", branch: null }, branches), []);
});
