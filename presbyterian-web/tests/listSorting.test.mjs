// Sorting and filtering the dashboard's lists (AGENT_EXECUTION_PLAN.md, Task 7.3). Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";

import { SECTIONS, listQuery } from "../Utilities/branchContent.mjs";

test("long lists offer a few sorts, the usual order first", () => {
  assert.deepEqual(SECTIONS.sermons.sorts.map((s) => s.value), ["", "preached_at", "title"]);
  assert.deepEqual(SECTIONS.activities.sorts.map((s) => s.value), ["", "date", "title"]);
  assert.deepEqual(SECTIONS.messages.sorts.map((s) => s.value), ["", "date", "title"]);
  assert.deepEqual(SECTIONS.writings.sorts.map((s) => s.value), ["", "-preached_on", "title"]);
  assert.equal(SECTIONS.ministers.sorts, undefined);
});

test("only listed sorts and statuses reach the API, with the page", () => {
  assert.deepEqual(listQuery("messages", { page: "2", status: "published", sort: "title" }), {
    page: 2, status: "published", sort: "title", api: "?page=2&status=published&ordering=title", keep: "status=published&sort=title",
  });
  assert.deepEqual(listQuery("messages", { page: "x", status: "nonsense", sort: "text" }), {
    page: 1, status: "", sort: "", api: "?page=1", keep: "",
  });
  assert.deepEqual(listQuery("ministers", { sort: "title" }), { page: 1, status: "", sort: "", api: "?page=1", keep: "" });
});
