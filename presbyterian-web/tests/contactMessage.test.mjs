// Contact form rules (AGENT_EXECUTION_PLAN.md, Task 1.1). Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";

import { clientIp, resolveRecipient, validateContact } from "../Utilities/contactMessage.js";

const valid = {
  fullName: "  Jane Banda ",
  phoneNumber: "0977 000 000",
  email: "jane@example.org",
  message: "Please pray for my family.",
};

test("valid submission passes with trimmed fields", () => {
  const result = validateContact(valid);
  assert.equal(result.ok, true);
  assert.equal(result.fields.fullName, "Jane Banda");
});

test("missing or blank fields are rejected", () => {
  for (const name of Object.keys(valid)) {
    assert.equal(validateContact({ ...valid, [name]: "   " }).ok, false, name);
    assert.equal(validateContact({ ...valid, [name]: undefined }).ok, false, name);
  }
});

test("malformed email is rejected", () => {
  for (const email of ["jane", "jane@", "@example.org", "jane @example.org", "jane@example"]) {
    assert.equal(validateContact({ ...valid, email }).ok, false, email);
  }
});

test("over-long fields are rejected", () => {
  assert.equal(validateContact({ ...valid, message: "x".repeat(5001) }).ok, false);
  assert.equal(validateContact({ ...valid, fullName: "x".repeat(101) }).ok, false);
});

test("line breaks in the name are rejected (it goes into the email subject)", () => {
  assert.equal(validateContact({ ...valid, fullName: "Jane\r\nBcc: x@y.z" }).ok, false);
});

test("client IP is the first x-forwarded-for entry", () => {
  assert.equal(clientIp("203.0.113.7, 10.0.0.1, 10.0.0.2"), "203.0.113.7");
  assert.equal(clientIp(" 203.0.113.7 "), "203.0.113.7");
  assert.equal(clientIp(null), "127.0.0.1");
  assert.equal(clientIp(""), "127.0.0.1");
});

test("branch messages go to that branch's contact email", async () => {
  const seen = [];
  const getBranch = async (slug) => {
    seen.push(slug);
    return { slug, contact_email: `${slug}@example.org` };
  };
  assert.equal(await resolveRecipient("chilanga", { getBranch }), "chilanga@example.org");
  assert.deepEqual(seen, ["chilanga"]);
});

test("unknown branch or branch without email has no recipient", async () => {
  assert.equal(await resolveRecipient("nowhere", { getBranch: async () => null }), null);
  assert.equal(
    await resolveRecipient("quiet", { getBranch: async () => ({ contact_email: "" }) }),
    null,
  );
});

test("a branch without its own email falls back to the national address", async () => {
  const getBranch = async () => ({ contact_email: "" });
  assert.equal(
    await resolveRecipient("kabushi", { getBranch, nationalEmail: "office@upcz.example" }),
    "office@upcz.example",
  );
});

test("an unknown branch never reaches the national address", async () => {
  const getBranch = async () => null;
  assert.equal(
    await resolveRecipient("nowhere", { getBranch, nationalEmail: "office@upcz.example" }),
    null,
  );
});

test("slugs that aren't plain slugs are refused without an API call", async () => {
  let called = false;
  const getBranch = async () => { called = true; return { contact_email: "x@example.org" }; };
  for (const slug of ["../giving-records", "a/b", "a?b=c", "a b"]) {
    assert.equal(await resolveRecipient(slug, { getBranch }), null, slug);
  }
  assert.equal(called, false);
});

test("national messages go to the national address when it is configured", async () => {
  const getBranch = async () => { throw new Error("should not be called"); };
  assert.equal(
    await resolveRecipient(null, { getBranch, nationalEmail: "office@upcz.example" }),
    "office@upcz.example",
  );
  assert.equal(await resolveRecipient(null, { getBranch, nationalEmail: "" }), null);
});
