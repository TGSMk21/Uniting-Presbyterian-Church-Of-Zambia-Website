// The Overview's work list (AGENT_EXECUTION_PLAN.md, Task 7.3). Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";

import { attentionItems, greeting } from "../Utilities/overview.mjs";

const branch = (extra = {}) => ({
  slug: "chilanga", name: "Chilanga", ai_drafts: 0, drafts: 0, sermons_waiting: 0, tomorrow_published: true, ...extra,
});
const overview = (branches, extra = {}) => ({ tomorrow: "2026-11-09", branches, requests_waiting: null, ...extra });

test("nothing to do gives an empty list", () => {
  assert.deepEqual(attentionItems(overview([branch()])), []);
});

test("each kind of task links to where it's done, most urgent first", () => {
  const items = attentionItems(overview(
    [branch({ ai_drafts: 2, tomorrow_published: false, sermons_waiting: 3 })],
    { requests_waiting: 1 },
  ));
  assert.deepEqual(items.map(({ text, href, tone }) => [text, href, tone]), [
    ["1 access request waiting", "/dashboard/requests", "warning"],
    ["2 AI drafts to check", "/dashboard/content/chilanga/messages?status=pending_review", "warning"],
    ["No daily message published for tomorrow, Mon 9 Nov", "/dashboard/content/chilanga/messages", "neutral"],
    ["3 sermons being read for daily messages", "/dashboard/content/chilanga/writings", "neutral"],
  ]);
});

test("with several branches, each task says which branch", () => {
  const items = attentionItems(overview([
    branch({ ai_drafts: 1 }),
    branch({ slug: "kabwe", name: "Kabwe", ai_drafts: 1 }),
  ]));
  assert.deepEqual(items.map((item) => item.text), ["Chilanga: 1 AI draft to check", "Kabwe: 1 AI draft to check"]);
});

test("greetings follow the time of day in Zambia", () => {
  assert.equal(greeting("Grace Banda", new Date("2026-11-08T05:00:00Z")), "Good morning, Grace");
  assert.equal(greeting("Grace Banda", new Date("2026-11-08T12:00:00Z")), "Good afternoon, Grace");
  assert.equal(greeting("grace.banda", new Date("2026-11-08T17:00:00Z")), "Good evening, grace.banda");
});
