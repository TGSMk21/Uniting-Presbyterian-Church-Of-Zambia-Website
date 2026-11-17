import { test } from "node:test";
import assert from "node:assert/strict";
import {
  emptyProfile, initialOf, normalizeName, profileErrors, profileFromForm,
} from "../src/lib/profile.js";

test("an empty profile is what Skip for now saves: nothing traps anyone", () => {
  assert.deepEqual(emptyProfile(), { name: "", branchSlug: "", email: "" });
  assert.deepEqual(profileFromForm({ name: "", branchSlug: "", email: "" }), emptyProfile());
});

test("names are trimmed, squashed and capped, so the greeting stays tidy", () => {
  assert.equal(normalizeName("  Mary   Banda "), "Mary Banda");
  assert.equal(normalizeName("x".repeat(80)).length, 40);
});

test("the avatar shows the first letter of the first name", () => {
  assert.equal(initialOf("mary"), "M");
  assert.equal(initialOf("  anna"), "A");
  assert.equal(initialOf(""), "");
});

test("email is optional, but when given it must look like an email", () => {
  assert.equal(profileErrors({ name: "Mary", branchSlug: "chilanga", email: "" }).email, null);
  assert.equal(profileErrors({ name: "Mary", branchSlug: "chilanga", email: "mary@example.org" }).email, null);
  assert.match(profileErrors({ name: "Mary", branchSlug: "chilanga", email: "not-an-email" }).email, /email/i);
});

test("profileFromForm normalizes and only keeps a known branch slug", () => {
  const profile = profileFromForm({ name: " Mary ", branchSlug: "chilanga", email: " mary@example.org " });
  assert.deepEqual(profile, { name: "Mary", branchSlug: "chilanga", email: "mary@example.org" });
  assert.equal(profileFromForm({ name: "Mary", branchSlug: "Bad Slug!", email: "" }).branchSlug, "");
});
