// Daily messages in the dashboard (AGENT_EXECUTION_PLAN.md, Task 5.3). Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  MESSAGE_STATUSES,
  SECTIONS,
  formValues,
  ministerChoices,
  newRowDefaults,
  publishedNote,
  rowBadges,
  rowSummary,
  saveFailure,
  tagsToClear,
  todayInZambia,
  valuesFromForm,
} from "../Utilities/branchContent.mjs";

function form(entries) {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.append(key, value);
  return data;
}

const spec = SECTIONS.messages;

test("the form asks for the message, its day and who wrote it", () => {
  assert.deepEqual(spec.fields.map((f) => f.key), [
    "minister", "date", "title", "reference_verse", "verse_text", "message", "status",
  ]);
  const required = spec.fields.filter((f) => f.required).map((f) => f.key);
  assert.deepEqual(required, ["minister", "date", "title", "message", "status"]);
  assert.equal(spec.adding, "Write a daily message");
  assert.equal(spec.canDelete, true);
  assert.equal(spec.publicPath("chilanga"), "/chilanga");
});

test("form limits match the API's", () => {
  const limits = Object.fromEntries(spec.fields.map((f) => [f.key, f.max]));
  assert.equal(limits.title, 300);
  assert.equal(limits.reference_verse, 100);
  assert.equal(limits.verse_text, 2000);
  assert.equal(limits.message, 10000);
});

test("the statuses are the API's", () => {
  assert.deepEqual(MESSAGE_STATUSES.map((s) => s.value), ["pending_review", "published", "rejected"]);
  assert.deepEqual(spec.fields.find((f) => f.key === "status").options, MESSAGE_STATUSES);
});

test("the minister list comes from the branch's ministers", () => {
  assert.equal(spec.fields.find((f) => f.key === "minister").choices, "ministers");
  assert.deepEqual(ministerChoices([{ id: 3, name: "Banda" }, { id: 9, name: "Mwale" }]), [
    { value: "3", label: "Banda" },
    { value: "9", label: "Mwale" },
  ]);
  assert.deepEqual(ministerChoices(undefined), []);
});

test("today is Zambia's today", () => {
  // 22:30 in London is already the next day in Lusaka.
  assert.equal(todayInZambia(new Date("2026-11-07T22:30:00Z")), "2026-11-08");
  assert.equal(todayInZambia(new Date("2026-11-07T21:59:00Z")), "2026-11-07");
});

test("a new message starts as a draft for today, by the first minister", () => {
  const now = new Date("2026-11-07T08:00:00Z");
  assert.deepEqual(newRowDefaults("messages", { ministers: [{ id: 3, name: "Banda" }], now }), {
    status: "pending_review", date: "2026-11-07", minister: "3",
  });
  assert.deepEqual(newRowDefaults("messages", { ministers: [], now }), {
    status: "pending_review", date: "2026-11-07", minister: "",
  });
  // Other sections keep their plain defaults.
  assert.deepEqual(newRowDefaults("projects", {}), { status: "PENDING", progress: "0" });
});

test("the boxes are sent as the API expects", () => {
  const values = valuesFromForm("messages", form({
    minister: "3", date: "2026-11-08", title: " Light ", reference_verse: "Psalm 119:105",
    verse_text: "", message: "Line one\r\nLine two", status: "published",
  }), { isNew: true });
  assert.deepEqual(values, {
    minister: "3", date: "2026-11-08", title: "Light", reference_verse: "Psalm 119:105",
    verse_text: "", message: "Line one\nLine two", status: "published",
  });
});

test("a saved message fills the boxes", () => {
  const values = formValues("messages", {
    id: 4, minister: 3, minister_name: "Banda", date: "2026-11-08", title: "Light",
    reference_verse: "", verse_text: "Your word", message: "Body", status: "published",
  });
  assert.equal(values.minister, "3");
  assert.equal(values.date, "2026-11-08");
  assert.equal(values.status, "published");
});

test("a clash with another published message is shown by the date", () => {
  const failure = saveFailure("messages", 400, { date: ["This minister already has a published message for this day."] });
  assert.match(failure.fields.date, /already has a published message/);
  assert.equal(failure.error, null);
});

test("list rows say the day and who; a label says whether it's on the website", () => {
  assert.equal(rowSummary("messages", { date: "2026-11-08", minister_name: "Banda", status: "published" }), "Sun, 8 Nov 2026 · Banda");
  assert.deepEqual(rowBadges("messages", { status: "published" }), [{ text: "Published", tone: "success" }]);
  assert.deepEqual(rowBadges("messages", { status: "pending_review" }), [{ text: "Draft", tone: "neutral" }]);
  assert.deepEqual(rowBadges("messages", { status: "rejected" }), [{ text: "Turned down", tone: "neutral" }]);
});

test("saving clears the home page's copy", () => {
  assert.deepEqual(tagsToClear("messages", "chilanga"), ["messages:chilanga"]);
  const source = readFileSync(new URL("../Services/api.js", import.meta.url), "utf8");
  const body = source.slice(source.indexOf("function getDailyMessages(")).split("\n}")[0];
  assert.match(body, /cachedFor\(sectionTag\(['"]messages['"]/);
});

test("the form fills a box's options from the page", () => {
  const source = readFileSync(new URL("../components/DashboardComponents/content-form.js", import.meta.url), "utf8");
  assert.match(source, /choices\[field\.choices\]/);
});

test("an open message says who published it and when, in Zambian time", () => {
  assert.equal(
    publishedNote({ published_at: "2026-11-07T07:30:00Z", reviewed_by_name: "Grace Banda" }),
    "Published on 7 Nov 2026 at 09:30 by Grace Banda.",
  );
  assert.equal(publishedNote({ published_at: "2026-11-07T07:30:00Z", reviewed_by_name: "" }), "Published on 7 Nov 2026 at 09:30.");
});

test("the list has tabs for each status, all messages first", () => {
  assert.deepEqual(SECTIONS.messages.filters.map((f) => [f.value, f.label]), [
    ["", "All"], ["pending_review", "To check"], ["published", "Published"], ["rejected", "Turned down"],
  ]);
  assert.equal(SECTIONS.sermons.filters, undefined);
});
