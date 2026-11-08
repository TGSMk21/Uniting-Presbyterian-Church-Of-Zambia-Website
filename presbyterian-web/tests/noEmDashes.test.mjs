// No em dashes in the website's paragraphs (owner's request, 2026-11-08), and the
// events heading is just "Events". Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { plainDashes } from "../Utilities/plainText.mjs";
import { pageFields } from "../Utilities/pageContent.mjs";
import { activityItem, projectItem } from "../Utilities/projectItems.mjs";
import schema from "../Utilities/pageSchema.json" with { type: "json" };

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("an em dash becomes a comma, whatever spaces surround it", () => {
  assert.equal(plainDashes("near you — a place to worship"), "near you, a place to worship");
  assert.equal(plainDashes("near you—a place"), "near you, a place");
  assert.equal(plainDashes("no dashes here, 2025 – 2026 stays"), "no dashes here, 2025 – 2026 stays");
  assert.equal(plainDashes(null), "");
});

test("the written wording has none, and typed wording is cleaned as it shows", () => {
  for (const kind of Object.values(schema)) for (const page of Object.values(kind)) for (const section of page.sections) {
    for (const field of section.fields) assert.ok(!/—/.test(field.default), `${field.key} still has an em dash`);
  }
  assert.equal(pageFields("national", "home", { hero_text: "A — B" }).hero_text, "A, B");
  for (const path of ["app/not-found.js", "app/layout.js", "app/[branch]/layout.js", "app/[branch]/page.js"]) {
    assert.doesNotMatch(read(path).replace(/title:.*\n/g, ""), /—/, path);
  }
});

test("text staff or the daily message writer type is cleaned on the way to the page", () => {
  const item = projectItem({ id: 1, title: "T — U", description: "One — two", start_date: "2026-01-01", photos: [] });
  assert.deepEqual(item.paragraphs, ["One, two"]);
  assert.equal(item.title, "T, U");
  assert.equal(activityItem({ id: 1, title: "x", date: "2026-12-01", details: "a — b", photos: [] }).paragraphs[0], "a, b");
  const home = read("app/[branch]/page.js");
  assert.match(home, /plainDashes\(msg\.message\)/);
  assert.match(home, /plainDashes\(item\.body\)/);
});

test("the events heading no longer says nationwide", () => {
  const section = schema.national.home.sections.find((s) => s.fields.some((f) => f.key === "events_label"));
  assert.equal(section.title, "Events");
  assert.equal(section.fields.find((f) => f.key === "events_label").default, "Events");
});
