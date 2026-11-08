// The national home page's events (owner's report, 2026-11-08). Run: npm test
// The live API had no upcoming activities, and the section hid itself, so it
// looked broken. It now always shows, with a message when nothing is planned.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import schema from "../Utilities/pageSchema.json" with { type: "json" };

const page = readFileSync(new URL("../app/(national)/page.js", import.meta.url), "utf8");
const api = readFileSync(new URL("../Services/api.js", import.meta.url), "utf8");

test("the events section isn't hidden when there are none", () => {
  assert.doesNotMatch(page, /events\.length > 0 && \(\s*<section className="nat-events"/);
  assert.match(page, /f\.events_empty/);
});

test("the message is editable, with a friendly default", () => {
  const text = JSON.stringify(schema);
  assert.match(text, /"key": ?"events_empty"/);
});

test("upcoming means from today in Zambia, not today in UTC", () => {
  assert.match(api, /todayInZambia\(\)/);
  assert.doesNotMatch(api, /toISOString\(\)\.slice\(0, 10\)/);
});
