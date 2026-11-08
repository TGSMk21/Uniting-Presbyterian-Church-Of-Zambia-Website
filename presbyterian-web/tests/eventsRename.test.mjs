// "Activities" are called "events" on the website and dashboard (owner's request,
// 2026-11-08). The code and API keep the old name. Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SECTIONS } from "../Utilities/branchContent.mjs";
import schema from "../Utilities/pageSchema.json" with { type: "json" };

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("old addresses and card links still work", () => {
  assert.match(read("next.config.mjs"), /source: "\/:branch\/projects-and-activities", destination: "\/:branch\/projects-and-events", permanent: true/);
  assert.match(read("components/ProjectsComponents/item-board.js"), /\.replace\(\/\^activity-\/, "event-"\)/);
});

test("staff and visitors read 'events', never 'activities'", () => {
  assert.equal(SECTIONS.activities.label, "Events");
  assert.equal(SECTIONS.activities.adding, "Add an event");
  const words = [];
  for (const kind of Object.values(schema)) for (const page of Object.values(kind)) {
    words.push(page.label, page.path);
    for (const section of page.sections) {
      words.push(section.title);
      // The children's fellowship text uses "activities" in its everyday sense.
      for (const field of section.fields) if (field.key !== "children_text") words.push(field.label, field.default);
    }
  }
  assert.deepEqual(words.filter((w) => /activit/i.test(w)), []);
  for (const path of ["app/[branch]/layout.js", "app/dashboard/(staff)/page.js", "Utilities/staffAdmin.mjs"]) {
    assert.doesNotMatch(read(path).replace(/["']activities["']|activities\//g, ""), /Activit|an activity/, path);
  }
});
