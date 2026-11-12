// Notifications in the dashboard (AGENT_EXECUTION_PLAN.md, Task 8.2). Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { bellLabel, safeDashboardLink } from "../Utilities/workspace.mjs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("a notification only ever opens a page inside the dashboard", () => {
  assert.equal(safeDashboardLink("/dashboard/meetings/4"), "/dashboard/meetings/4");
  for (const bad of ["https://evil.example", "//evil.example/dashboard", "/dashboard//evil", "javascript:alert(1)", "", null]) {
    assert.equal(safeDashboardLink(bad), "/dashboard/notifications", String(bad));
  }
});

test("the bell says how many are unread in words a screen reader can read", () => {
  assert.equal(bellLabel(0), "Notifications");
  assert.equal(bellLabel(1), "Notifications, 1 unread");
  assert.equal(bellLabel(12), "Notifications, 12 unread");
});

test("the bell sits in the sidebar and the phone bar, for workspace members", () => {
  const shell = read("components/DashboardComponents/dashboard-shell.js");
  assert.equal((shell.match(/<NotificationBell /g) || []).length, 2);
  const layout = read("app/dashboard/(staff)/layout.js");
  assert.match(layout, /workspace_member/);
  assert.match(layout, /\/workspace\/notifications\//);
  const actions = read("app/dashboard/workspace-actions.js");
  assert.match(actions, /\/workspace\/notifications\/\$\{id\}\/read\//);
  assert.match(actions, /safeDashboardLink\(/);
});
