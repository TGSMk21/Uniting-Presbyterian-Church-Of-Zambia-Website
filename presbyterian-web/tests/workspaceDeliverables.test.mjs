import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { STATUS, deliverableFromForm, deliverableState, dueText, templateFor, workspaceAttention }
  from "../Utilities/deliverables.mjs";
import { handlesContent, navGroups } from "../Utilities/dashboardNav.mjs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

function form(values) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.append(key, value);
  return data;
}

test("a deliverable's state reads plainly, overdue first", () => {
  assert.deepEqual(deliverableState({ status: "todo", overdue: true }), { label: "Overdue", tone: "danger" });
  assert.deepEqual(deliverableState({ status: "todo", overdue: false }), { label: "To do", tone: "neutral" });
  assert.deepEqual(deliverableState({ status: "submitted" }), { label: "Handed in", tone: "warning" });
  assert.deepEqual(deliverableState({ status: "accepted" }), { label: "Accepted", tone: "success" });
  assert.deepEqual(deliverableState({ status: "changes", overdue: false }), { label: "Needs changes", tone: "danger" });
  assert.equal(STATUS.submitted, "Handed in");
});

test("due dates read as a day", () => {
  assert.equal(dueText("2026-11-17"), "Tue 17 Nov");
  assert.equal(dueText("nonsense"), "");
});

test("a new deliverable's form becomes the API's body", () => {
  assert.deepEqual(deliverableFromForm(form({ title: " Budget ", assignee: "12", due_on: "2026-11-17", notes: "" }), 5),
    { body: { meeting: 5, title: "Budget", assignee: 12, due_on: "2026-11-17", notes: "" } });
  assert.deepEqual(deliverableFromForm(form({ title: "Budget", assignee: "", due_on: "2026-11-17" }), 5).body.assignee, null);
  assert.match(deliverableFromForm(form({ title: " ", due_on: "2026-11-17" }), 5).error, /what/i);
  assert.match(deliverableFromForm(form({ title: "Budget", due_on: "" }), 5).error, /date/i);
  assert.match(deliverableFromForm(form({ title: "Budget", due_on: "2026-11-17", assignee: "x" }), 5).error, /person/i);
  assert.equal(deliverableFromForm(form({ title: "Budget", due_on: "2026-11-17" }), "x").error, "This meeting couldn't be found.");
});

test("the usual checklist for a kind of meeting is offered first", () => {
  const templates = [{ id: 1, level: "branch", name: "Session meeting" }, { id: 2, level: "synod", name: "Synod meeting" }];
  assert.equal(templateFor(templates, "branch:kabwata")?.id, 1);
  assert.equal(templateFor(templates, "synod")?.id, 2);
  assert.equal(templateFor(templates, "presbytery:munali"), null);
  assert.equal(templateFor(templates, ""), null);
});

test("the Overview gathers the workspace's reminders, most urgent first", () => {
  const items = workspaceAttention({
    answer_needed: 2,
    to_review: 1,
    deliverables: [
      { id: 7, title: "Minutes", overdue: true, due_on: "2026-11-10", meeting: { id: 3, title: "Session meeting" } },
      { id: 8, title: "Budget", overdue: false, due_on: "2026-11-17", meeting: { id: 4, title: "Finance" } },
    ],
    meetings: [{ id: 4, title: "Finance", starts_at: "2026-11-14T08:00:00Z", ends_at: null, my_response: "attending" }],
  });
  assert.deepEqual(items.map((i) => [i.text, i.href, i.tone]), [
    ["Minutes for Session meeting was due Tue 10 Nov", "/dashboard/meetings/3", "danger"],
    ["1 deliverable handed in for you to check", "/dashboard/deliverables?view=review", "warning"],
    ["2 meeting invitations to answer", "/dashboard/meetings", "warning"],
    ["Budget for Finance is due Tue 17 Nov", "/dashboard/meetings/4", "neutral"],
    ["Finance, Sat 14 Nov, 10:00", "/dashboard/meetings/4", "info"],
  ]);
  assert.deepEqual(workspaceAttention(null), []);
});

test("elders don't get website-content reminders or the Deliverables page hidden", () => {
  assert.equal(handlesContent({ role: "elder" }), false);
  assert.equal(handlesContent({ role: "content_editor" }), true);
  assert.equal(handlesContent({ is_superuser: true }), true);
  const items = (navGroups({ role: "elder", workspace_member: true }).find((g) => g.label === "Workspace")?.items ?? [])
    .map((i) => i.href);
  assert.ok(items.includes("/dashboard/deliverables"));
  const page = read("app/dashboard/(staff)/page.js");
  assert.match(page, /handlesContent\(staff\)/);
  assert.match(page, /\/workspace\/attention\//);
});

test("only the superuser edits the checklists", () => {
  const items = (staff) => (navGroups(staff).find((g) => g.label === "Workspace")?.items ?? []).map((i) => i.href);
  assert.ok(items({ is_superuser: true, workspace_member: true }).includes("/dashboard/checklists"));
  assert.ok(!items({ role: "branch_admin", workspace_member: true }).includes("/dashboard/checklists"));
});
