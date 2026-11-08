// The branch site's menu (owner's request, 2026-11-08). Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { SECTIONS } from "../Utilities/branchContent.mjs";
import schema from "../Utilities/pageSchema.json" with { type: "json" };

const layout = readFileSync(new URL("../app/[branch]/layout.js", import.meta.url), "utf8");

test("the menu says Projects & Events, not just Projects", () => {
  assert.match(layout, /label: "Projects & Events", href: `\$\{base\}\/projects-and-events`/);
  assert.doesNotMatch(layout, /label: "Projects",/);
});

test("the dashboard calls it the same", () => {
  assert.match(SECTIONS.projects.intro, /Projects & Events page/);
  assert.match(SECTIONS.activities.intro, /Projects & Events page/);
  assert.match(JSON.stringify(schema), /"label": ?"Projects & Events page"/);
});
