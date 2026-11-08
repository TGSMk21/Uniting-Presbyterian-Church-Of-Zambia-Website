// General announcements (owner's request, 2026-11-08). Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { SECTIONS, newRowDefaults, rowBadges, rowSummary, tagsToClear, valuesFromForm } from "../Utilities/branchContent.mjs";

function form(entries) {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.append(key, value);
  return data;
}

test("staff fill in a title, the words, the days and whether to pin it", () => {
  const fields = Object.fromEntries(SECTIONS.announcements.fields.map((f) => [f.key, f]));
  assert.equal(fields.title.max, 200);
  assert.equal(fields.body.max, 2000);
  assert.equal(fields.starts_on.required, true);
  assert.equal(fields.ends_on.required, undefined);
  assert.equal(fields.is_pinned.type, "checkbox");
  assert.equal(newRowDefaults("announcements", { now: new Date("2026-11-08T08:00:00Z") }).starts_on, "2026-11-08");
  const values = valuesFromForm("announcements", form({ title: "T", body: "B", starts_on: "2026-11-08", ends_on: "" }), { isNew: true });
  assert.deepEqual(values, { title: "T", body: "B", starts_on: "2026-11-08", ends_on: null, is_pinned: false });
});

test("the list says the days and whether it's on the website now", () => {
  const now = new Date("2026-11-08T08:00:00Z");
  assert.equal(rowSummary("announcements", { starts_on: "2026-11-08", ends_on: "2026-11-15" }), "8 Nov – 15 Nov 2026");
  assert.equal(rowSummary("announcements", { starts_on: "2026-11-08", ends_on: null }), "From 8 Nov 2026");
  assert.deepEqual(rowBadges("announcements", { starts_on: "2026-11-01", ends_on: null, is_pinned: true }, now),
    [{ text: "Pinned", tone: "warning" }, { text: "Showing", tone: "success" }]);
  assert.deepEqual(rowBadges("announcements", { starts_on: "2026-11-09", ends_on: null }, now), [{ text: "Starts later", tone: "neutral" }]);
  assert.deepEqual(rowBadges("announcements", { starts_on: "2026-11-01", ends_on: "2026-11-07" }, now), [{ text: "Ended", tone: "neutral" }]);
});

test("saving one refreshes the branch's home page", () => {
  assert.deepEqual(tagsToClear("announcements", "chilanga"), ["announcements:chilanga"]);
  assert.equal(SECTIONS.announcements.publicPath("chilanga"), "/chilanga#announcements");
});

test("the branch home page shows them", () => {
  const home = readFileSync(new URL("../app/[branch]/page.js", import.meta.url), "utf8");
  assert.match(home, /getAnnouncements\(/);
  assert.match(home, /id="announcements"/);
});
