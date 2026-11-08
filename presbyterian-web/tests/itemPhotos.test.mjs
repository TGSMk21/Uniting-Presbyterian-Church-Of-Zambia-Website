// Photos on projects and activities (owner's request, 2026-11-08). Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { ITEM_PHOTOS, SECTIONS } from "../Utilities/branchContent.mjs";

test("projects and activities take photos, within the API's limits", () => {
  assert.deepEqual(ITEM_PHOTOS, { max_side: 1600, transparent: false, most: 12 });
  assert.equal(SECTIONS.projects.photos, true);
  assert.equal(SECTIONS.activities.photos, true);
  assert.equal(SECTIONS.sermons.photos, undefined);
});

test("their pages offer the photo manager", () => {
  const page = readFileSync(new URL("../app/dashboard/(staff)/content/[branch]/[section]/[id]/page.js", import.meta.url), "utf8");
  assert.match(page, /spec\.photos && <ItemPhotos/);
});
