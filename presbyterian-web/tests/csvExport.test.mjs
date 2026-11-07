// CSV export from the dashboard (AGENT_EXECUTION_PLAN.md, Task 5.3). Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { EXPORT_SECTIONS, exportApiPath, exportHref, safeDisposition } from "../Utilities/csvExport.mjs";

test("every section can be exported, and nothing else", () => {
  assert.deepEqual(EXPORT_SECTIONS, ["sermons", "projects", "activities", "ministers", "services", "messages", "media"]);
  assert.equal(exportApiPath("chilanga", "projects"), "/staff/chilanga/projects/export/");
  assert.equal(exportApiPath("chilanga", "pages"), null);
  assert.equal(exportApiPath("chilanga", "toString"), null);
  assert.equal(exportApiPath("../auth", "projects"), null);
});

test("the media library's filters carry over, safely", () => {
  assert.equal(
    exportApiPath("chilanga", "media", { type: "image", tag: "Easter", q: "choir", page: "3" }),
    "/staff/chilanga/media/export/?type=image&tag=Easter&q=choir",
  );
  assert.equal(exportApiPath("chilanga", "media", { type: "video" }), "/staff/chilanga/media/export/");
  // Other sections take no filters.
  assert.equal(exportApiPath("chilanga", "projects", { q: "x" }), "/staff/chilanga/projects/export/");
  assert.equal(exportHref("chilanga", "media", "?page=2&type=image"), "/dashboard/content/chilanga/media/export?type=image");
  assert.equal(exportHref("chilanga", "sermons"), "/dashboard/content/chilanga/sermons/export");
});

test("only a plain file name is passed on to the browser", () => {
  assert.equal(
    safeDisposition('attachment; filename="chilanga-projects-2026-11-07.csv"'),
    'attachment; filename="chilanga-projects-2026-11-07.csv"',
  );
  for (const odd of [null, "", 'inline; filename="x.csv"', 'attachment; filename="../x.csv"', 'attachment; filename="x.html"',
    'attachment; filename="a.csv"\r\nSet-Cookie: x=1']) {
    assert.equal(safeDisposition(odd), 'attachment; filename="export.csv"', String(odd));
  }
});

test("both download addresses exist and check who is signed in", () => {
  for (const path of [
    "../app/dashboard/(staff)/content/[branch]/[section]/export/route.js",
    "../app/dashboard/(staff)/content/[branch]/media/export/route.js",
  ]) {
    const url = new URL(path, import.meta.url);
    assert.ok(existsSync(url), path);
    assert.match(readFileSync(url, "utf8"), /exportResponse\(/, path);
  }
  const shared = readFileSync(new URL("../app/dashboard/content-export.js", import.meta.url), "utf8");
  assert.match(shared, /currentStaff\(\)/);
  assert.match(shared, /must_change_password/);
  assert.match(shared, /must_set_up_two_factor/);
  assert.match(shared, /"Cache-Control": "no-store"/);
});
