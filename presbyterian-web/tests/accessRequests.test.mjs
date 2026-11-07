// Asking for access, approving it, and choosing a password from a link
// (AGENT_EXECUTION_PLAN.md, Task 7.2). Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  KINDS,
  approvalFromForm,
  approvalFailure,
  linkTokenFrom,
  requestFailure,
  requestFromForm,
  requestSummary,
  setPasswordAddress,
  shareMessage,
  suggestedUsername,
} from "../Utilities/accessRequests.mjs";

function form(entries) {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.append(key, value);
  return data;
}

test("a request sends trimmed details, including the hidden box robots fill in", () => {
  const values = requestFromForm(form({
    full_name: "  Grace Banda ", email: " grace@example.org ", phone: "097 123 4567 ",
    branch: "alpha", kind: "minister", note: " Hello\r\nthere ", website: "",
  }));
  assert.deepEqual(values, {
    full_name: "Grace Banda", email: "grace@example.org", phone: "097 123 4567",
    branch: "alpha", kind: "minister", note: "Hello\nthere", website: "",
  });
  assert.deepEqual(KINDS.map((k) => k.value), ["minister", "staff"]);
});

test("refusals are shown by the right box, and too many tries says to wait", () => {
  assert.deepEqual(requestFailure(400, { email: ["Enter a valid email address."] }), {
    error: null, fields: { email: "Enter a valid email address." },
  });
  assert.match(requestFailure(429).error, /an hour/);
  assert.match(requestFailure(500).error, /try again/);
});

test("the link's secret is read from after the # and nothing else is accepted", () => {
  const token = "A".repeat(43);
  assert.equal(linkTokenFrom(`#${token}`), token);
  assert.equal(linkTokenFrom(`#${token}&x=1`), null);
  assert.equal(linkTokenFrom("#short"), null);
  assert.equal(linkTokenFrom(""), null);
  assert.equal(setPasswordAddress("https://upcz.example", token), `https://upcz.example/dashboard/set-password#${token}`);
});

test("the message to send says what to do and when the link stops working", () => {
  const text = shareMessage({ firstName: "Grace", username: "grace", link: "https://x/dashboard/set-password#t" });
  assert.match(text, /^Hello Grace,/);
  assert.match(text, /username is grace/);
  assert.match(text, /https:\/\/x\/dashboard\/set-password#t/);
  assert.match(text, /3 days/);
});

test("usernames are suggested from the name", () => {
  assert.equal(suggestedUsername("Grace  Banda"), "grace.banda");
  assert.equal(suggestedUsername("Rev. Joseph Mwale-Phiri"), "rev.joseph.mwale-phiri");
  assert.equal(suggestedUsername("Ŵezi Zulu"), "wezi.zulu");
  assert.equal(suggestedUsername("!!!"), "");
});

test("an approval sends only what this person may choose", () => {
  const data = form({ username: " grace ", minister: "7", role: "branch_admin", branch: "beta" });
  assert.deepEqual(approvalFromForm(data, { superuser: true, kind: "minister" }), { username: "grace", minister: "7" });
  assert.deepEqual(approvalFromForm(data, { superuser: true, kind: "staff" }), { username: "grace", role: "branch_admin", branch: "beta" });
  assert.deepEqual(approvalFromForm(data, { superuser: false, kind: "staff" }), { username: "grace" });
  assert.equal(approvalFailure(409).error, "This request has already been decided.");
  assert.deepEqual(approvalFailure(400, { minister: ["Choose one."] }).fields, { minister: "Choose one." });
});

test("the list says who, where and what happened", () => {
  assert.equal(
    requestSummary({ kind_label: "Minister", branch_name: "Alpha", status: "waiting", created_at: "2026-11-08T08:00:00+02:00" }),
    "Minister · Alpha · Asked 8 Nov 2026",
  );
  assert.equal(
    requestSummary({ kind_label: "Other staff", branch_name: "Alpha", status: "approved", account_username: "grace", decided_by_name: "tmk", created_at: "2026-11-08T08:00:00+02:00" }),
    "Other staff · Alpha · Approved by tmk as grace",
  );
  assert.equal(
    requestSummary({ kind_label: "Minister", branch_name: "Alpha", status: "turned_down", decided_by_name: "tmk", created_at: "2026-11-08T08:00:00+02:00" }),
    "Minister · Alpha · Turned down by tmk",
  );
});

test("a password reset's message says so", () => {
  const text = shareMessage({ firstName: "Grace", username: "grace", link: "https://x/l", reset: true });
  assert.match(text, /choose a new password for your UPCZ staff dashboard account \(username grace\)/);
  assert.doesNotMatch(text, /is ready/);
});
