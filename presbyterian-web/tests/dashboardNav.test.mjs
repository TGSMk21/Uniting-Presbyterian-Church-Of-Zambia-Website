// The dashboard's sidebar (AGENT_EXECUTION_PLAN.md, Task 7.3). Run: npm test
// It only offers what each person can use; the API still checks everything.
import { test } from "node:test";
import assert from "node:assert/strict";

import { activeHref, navGroups } from "../Utilities/dashboardNav.mjs";

const minister = { is_superuser: false, role: "branch_admin", branch: { slug: "chilanga", name: "Chilanga" } };
const editor = { ...minister, role: "content_editor" };
const superuser = { is_superuser: true, role: "content_editor", branch: null };
const finance = { is_superuser: false, role: "finance_admin", branch: { slug: "chilanga", name: "Chilanga" } };

const hrefs = (staff) => navGroups(staff).flatMap((group) => group.items.map((item) => item.href));

test("a branch's staff go straight to their own branch's sections", () => {
  assert.deepEqual(hrefs(editor), [
    "/dashboard",
    "/dashboard/content/chilanga/messages",
    "/dashboard/content/chilanga/writings",
    "/dashboard/content",
    "/dashboard/content/chilanga/media",
    "/dashboard/pages",
  ]);
});

test("a minister also manages staff and their branch's requests", () => {
  assert.deepEqual(hrefs(minister).slice(-2), ["/dashboard/staff", "/dashboard/requests"]);
});

test("superusers get every branch's lists and the site-wide sections", () => {
  assert.deepEqual(hrefs(superuser), [
    "/dashboard", "/dashboard/content", "/dashboard/pages",
    "/dashboard/staff", "/dashboard/requests", "/dashboard/branches", "/dashboard/history",
  ]);
});

test("roles without content see only the overview", () => {
  assert.deepEqual(hrefs(finance), ["/dashboard"]);
});

test("groups are labelled, and empty ones are left out", () => {
  assert.deepEqual(navGroups(minister).map((g) => g.label), ["", "Content", "People"]);
  assert.deepEqual(navGroups(superuser).map((g) => g.label), ["", "Content", "People", "Site"]);
  assert.deepEqual(navGroups(finance).map((g) => g.label), [""]);
});

test("the current page lights up its closest link", () => {
  const links = hrefs(editor);
  assert.equal(activeHref("/dashboard", links), "/dashboard");
  assert.equal(activeHref("/dashboard/content/chilanga/messages/12", links), "/dashboard/content/chilanga/messages");
  assert.equal(activeHref("/dashboard/content/chilanga/sermons", links), "/dashboard/content");
  assert.equal(activeHref("/dashboard/pages/chilanga/home", links), "/dashboard/pages");
  assert.equal(activeHref("/dashboard/contentious", links), "/dashboard");
});
