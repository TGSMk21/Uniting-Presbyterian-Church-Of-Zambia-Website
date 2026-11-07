// Written sermons in the dashboard (AGENT_EXECUTION_PLAN.md, Task 4.1). Run: npm test
// They're private: never on the website, so nothing on it is cleared when they change.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { SECTIONS, aiDraftNote, newRowDefaults, rowSummary, tagsToClear, valuesFromForm } from "../Utilities/branchContent.mjs";
import {
  SERMON_ACCEPT,
  SERMON_MAX_BYTES,
  checkSermonFile,
  sermonUploadFailure,
  uploadSummary,
} from "../Utilities/sermonWritings.mjs";

const file = (name, size, type = "") => ({ name, size, type });

function form(entries) {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.append(key, value);
  return data;
}

test("written sermons are private and limited like the API", () => {
  const spec = SECTIONS.writings;
  assert.equal(spec.publicPath, null);
  assert.equal(spec.canDelete, true);
  assert.equal(spec.uploads, true);
  const limits = Object.fromEntries(spec.fields.map((f) => [f.key, f.max]));
  assert.equal(limits.title, 300);
  assert.equal(limits.text, 200000);
  assert.deepEqual(tagsToClear("writings", "alpha"), []);
  assert.equal(SERMON_MAX_BYTES, 4_000_000);
  assert.equal(SERMON_ACCEPT, ".docx,.pdf,.txt");
});

test("a pasted sermon starts with the branch's first minister", () => {
  const values = newRowDefaults("writings", { ministers: [{ id: 7, name: "Banda" }] });
  assert.equal(values.minister, "7");
  assert.deepEqual(newRowDefaults("writings", {}), { minister: "" });
});

test("an empty preached date is cleared, and the words are sent as typed", () => {
  const values = valuesFromForm("writings", form({
    minister: "7", title: "Grace", preached_on: "", text: "First.\r\n\r\nSecond.",
  }), { isNew: true });
  assert.deepEqual(values, { minister: "7", title: "Grace", preached_on: null, text: "First.\n\nSecond." });
});

test("the list says who, when, how long, and whether it has been read", () => {
  const row = { minister_name: "Banda", preached_on: "2026-10-04", word_count: 1520, ready: true };
  assert.equal(rowSummary("writings", row), "Sun, 4 Oct 2026 · Banda · 1,520 words · Ready for daily messages");
  assert.equal(
    rowSummary("writings", { ...row, preached_on: null, ready: false, word_count: 1 }),
    "Banda · 1 word · Waiting to be read",
  );
});

test("files are checked before they're sent", () => {
  assert.equal(checkSermonFile(undefined), "Please choose a file.");
  assert.equal(checkSermonFile(file("a.docx", 0)), "This file is empty.");
  assert.equal(checkSermonFile(file("a.docx", SERMON_MAX_BYTES + 1)), "This file is too large. Files can be up to 4 MB.");
  assert.match(checkSermonFile(file("a.doc", 10)), /Save it as a \.docx/);
  assert.match(checkSermonFile(file("photo.jpg", 10, "image/jpeg")), /Word \(\.docx\), PDF or plain text/);
  for (const name of ["a.docx", "B.PDF", "notes.txt"]) assert.equal(checkSermonFile(file(name, 10)), null, name);
});

test("the API's reasons are shown for each file", () => {
  assert.deepEqual(sermonUploadFailure(401), { signedOut: true });
  assert.equal(sermonUploadFailure(400, { file: ["This PDF has no text to read."] }).error, "This PDF has no text to read.");
  assert.equal(sermonUploadFailure(400, { minister: ["Invalid pk"] }).error, "Please choose one of your ministers.");
  assert.equal(sermonUploadFailure(403).error, "You can't change this branch's content.");
  assert.equal(sermonUploadFailure(413).error, "This file is too large. Files can be up to 4 MB.");
  assert.equal(sermonUploadFailure(500).error, "This file couldn't be added right now. Please try again in a moment.");
});

test("a summary after adding several files", () => {
  assert.equal(uploadSummary([{ ok: true }, { ok: true }]), "Added 2 sermons.");
  assert.equal(uploadSummary([{ ok: true }, { ok: false }]), "Added 1 sermon. 1 couldn't be added: see below.");
  assert.equal(uploadSummary([{ ok: false }]), "Nothing was added: see below.");
});

test("deleting a private sermon doesn't talk about the website", () => {
  const source = readFileSync(new URL("../components/DashboardComponents/content-form.js", import.meta.url), "utf8");
  assert.match(source, /spec\.publicPath/);
});

test("staff turn AI drafts on per minister and describe how they write", () => {
  const fields = Object.fromEntries(SECTIONS.ministers.fields.map((f) => [f.key, f]));
  assert.equal(fields.ai_drafts.type, "checkbox");
  assert.equal(fields.style_notes.type, "textarea");
  assert.equal(fields.style_notes.max, 5000);
  const values = valuesFromForm("ministers", form({ name: "Banda", bio: "", order: "0", style_notes: "Short.", ai_drafts: "on" }), { isNew: false });
  assert.equal(values.ai_drafts, true);
  assert.equal(values.style_notes, "Short.");
});

test("sermons of ministers with drafts off say so instead of waiting", () => {
  const row = { minister_name: "Banda", preached_on: null, word_count: 10, ready: false, minister_ai_drafts: false };
  assert.equal(rowSummary("writings", row), "Banda · 10 words · Drafts are off for this minister");
  assert.equal(rowSummary("writings", { ...row, minister_ai_drafts: true }), "Banda · 10 words · Waiting to be read");
});

test("AI drafts are marked, and say what to check", () => {
  assert.equal(aiDraftNote({ ai_generated: false }), null);
  assert.equal(
    aiDraftNote({ ai_generated: true, source_titles: ["The Good Shepherd", "Grace"] }),
    "Written by AI from these sermons: The Good Shepherd, Grace. Please read it carefully, and check the verse's words in your Bible, before publishing.",
  );
  assert.match(aiDraftNote({ ai_generated: true, source_titles: [] }), /^Written by AI\. Please read/);
  assert.equal(rowSummary("messages", { date: "2026-11-09", minister_name: "Banda", status: "pending_review", ai_generated: true }),
    "Mon, 9 Nov 2026 · Banda · AI draft");
});
