// Reviewing a daily message (AGENT_EXECUTION_PLAN.md, Task 7.3). Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";

import { messageParagraphs, reviewActions, statusLabel } from "../Utilities/messageReview.mjs";

test("each status offers the next sensible steps, the main one first", () => {
  assert.deepEqual(reviewActions("pending_review"), [
    { status: "published", label: "Publish", kind: "primary" },
    { status: "rejected", label: "Turn down", kind: "danger" },
  ]);
  assert.deepEqual(reviewActions("published"), [{ status: "pending_review", label: "Unpublish", kind: "secondary" }]);
  assert.deepEqual(reviewActions("rejected"), [{ status: "pending_review", label: "Back to draft", kind: "secondary" }]);
  assert.deepEqual(reviewActions("anything else"), []);
});

test("statuses read plainly, and AI drafts say so", () => {
  assert.deepEqual(statusLabel({ status: "pending_review", ai_generated: true }), { text: "AI draft", tone: "warning" });
  assert.deepEqual(statusLabel({ status: "pending_review", ai_generated: false }), { text: "Draft", tone: "neutral" });
  assert.deepEqual(statusLabel({ status: "published" }), { text: "Published", tone: "success" });
  assert.deepEqual(statusLabel({ status: "rejected" }), { text: "Turned down", tone: "neutral" });
});

test("the preview keeps the message's paragraphs", () => {
  assert.deepEqual(messageParagraphs("First.\n\nSecond line\nstill second.\n\n\nThird."), ["First.", "Second line\nstill second.", "Third."]);
  assert.deepEqual(messageParagraphs(""), []);
});
