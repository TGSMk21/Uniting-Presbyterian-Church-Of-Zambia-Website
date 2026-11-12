// The shared workspace, Task 8.1: the church's structure, elders and offices
// (AGENT_EXECUTION_PLAN.md, Phase 8). Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { navGroups } from "../Utilities/dashboardNav.mjs";
import { BRANCH_ROLES, STAFF_ROLES, branchFromForm, personFromForm } from "../Utilities/staffAdmin.mjs";
import { approvalFromForm } from "../Utilities/accessRequests.mjs";
import { LEVELS, levelLabel, officeRows, placeTitle } from "../Utilities/workspace.mjs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const form = (values) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.append(key, value);
  return data;
};
const hrefs = (staff) => navGroups(staff).flatMap((group) => group.items.map((item) => item.href));

test("elders are a role ministers and superusers can give", () => {
  assert.ok(STAFF_ROLES.some((role) => role.value === "elder" && role.label === "Elder / office bearer"));
  assert.deepEqual(BRANCH_ROLES.map((role) => role.value), ["content_editor", "elder"]);
  // A minister's form sends the role they chose, but only one of theirs to give.
  assert.equal(personFromForm(form({ role: "elder" }), { superuser: false, isNew: true }).role, "elder");
  assert.equal(personFromForm(form({ role: "branch_admin" }), { superuser: false, isNew: true }).role, undefined);
  assert.equal(approvalFromForm(form({ username: "g", role: "elder" }), { superuser: false, kind: "staff" }).role, "elder");
});

test("a superuser places a branch in a presbytery", () => {
  assert.equal(branchFromForm(form({ name: "A", presbytery: "munali" }), { isNew: false }).presbytery, "munali");
  assert.equal(branchFromForm(form({ name: "A", presbytery: "" }), { isNew: false }).presbytery, null);
});

test("the workspace is in the sidebar for members only, and elders see nothing of the website", () => {
  const minister = { role: "branch_admin", branch: { slug: "a1" }, workspace_member: true };
  const elder = { role: "elder", branch: { slug: "a1" }, workspace_member: true };
  const editor = { role: "content_editor", branch: { slug: "a1" }, workspace_member: false };
  assert.ok(hrefs(minister).includes("/dashboard/structure"));
  assert.ok(hrefs(elder).includes("/dashboard/structure"));
  assert.ok(!hrefs(editor).includes("/dashboard/structure"));
  assert.deepEqual(hrefs(elder).filter((href) => /content|pages|media|staff|requests/.test(href)), []);
  assert.equal(navGroups(elder).find((group) => group.items.some((item) => item.href === "/dashboard/structure")).label, "Workspace");
});

test("levels and places are named the way the church says them", () => {
  assert.deepEqual(LEVELS.map((level) => level.value), ["branch", "presbytery", "synod"]);
  assert.equal(levelLabel("presbytery"), "Presbytery");
  assert.equal(placeTitle("presbytery", { name: "Munali" }), "Munali Presbytery");
  assert.equal(placeTitle("synod"), "Synod of Zambia");
  assert.equal(placeTitle("branch", { name: "Chilanga" }), "Chilanga");
});

test("every position at a place shows its holder or that nobody holds it", () => {
  const positions = [{ id: 1, name: "Session Clerk", level: "branch" }, { id: 2, name: "Treasurer", level: "branch" },
    { id: 3, name: "Clerk", level: "synod" }];
  const rows = officeRows(positions, "branch", [{ id: 9, title: "Treasurer", person: { id: 4, name: "Grace" } }]);
  assert.deepEqual(rows.map((row) => [row.position.name, row.holder?.person.name ?? null]),
    [["Session Clerk", null], ["Treasurer", "Grace"]]);
});

test("the structure page and the appoint controls are wired to the workspace addresses", () => {
  const actions = read("app/dashboard/workspace-actions.js");
  assert.match(actions, /"\/workspace\/appointments\/"/);
  assert.match(actions, /\/workspace\/people\/\?/);
  const page = read("app/dashboard/(staff)/structure/page.js");
  assert.match(page, /\/workspace\/structure\//);
  assert.match(page, /\/workspace\/me\//);
  assert.match(page, /notFound\(\)/);
});

import { apiMessages } from "../Utilities/workspace.mjs";

test("refusals read as plain sentences, however the API nests them", () => {
  assert.equal(apiMessages({ add: [{ non_field_errors: ["You can share with your own branch."] }, {}] }),
    "You can share with your own branch.");
  assert.equal(apiMessages({ title: ["Required."], file: ["Too big.", "Required."] }), "Required. Too big.");
  assert.equal(apiMessages({}), "");
});
