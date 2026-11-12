// Staff, branches and change history in the dashboard (AGENT_EXECUTION_PLAN.md, Task 5.4). Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  STAFF_ROLES,
  branchFailure,
  branchFromForm,
  canManageStaff,
  changeSummary,
  historyQuery,
  personFailure,
  ministerGroups,
  personFromForm,
  personSummary,
} from "../Utilities/staffAdmin.mjs";

function form(entries) {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.append(key, value);
  return data;
}

test("who manages staff matches the API", () => {
  assert.equal(canManageStaff({ is_superuser: true, role: "content_editor", branch: null }), true);
  assert.equal(canManageStaff({ is_superuser: false, role: "branch_admin", branch: { slug: "alpha" } }), true);
  assert.equal(canManageStaff({ is_superuser: false, role: "branch_admin", branch: null }), false);
  assert.equal(canManageStaff({ is_superuser: false, role: "content_editor", branch: { slug: "alpha" } }), false);
  assert.equal(canManageStaff({ is_superuser: false, role: "finance_admin", branch: { slug: "alpha" } }), false);
  assert.deepEqual(STAFF_ROLES.map((r) => r.value), ["content_editor", "elder", "branch_admin"]);
});

test("a branch admin's form sends no role or branch; a superuser's does", () => {
  const data = form({ username: " newbie ", first_name: " Grace ", last_name: "Phiri", email: "g@example.org", role: "branch_admin", branch: "beta" });
  assert.deepEqual(personFromForm(data, { superuser: false, isNew: true }), {
    username: "newbie", first_name: "Grace", last_name: "Phiri", email: "g@example.org",
  });
  assert.deepEqual(personFromForm(data, { superuser: true, isNew: true }), {
    username: "newbie", first_name: "Grace", last_name: "Phiri", email: "g@example.org", role: "branch_admin", branch: "beta",
    minister: null,
  });
  // Usernames can't change after.
  assert.equal("username" in personFromForm(data, { superuser: true, isNew: false }), false);
});

test("API complaints go by the right box", () => {
  assert.deepEqual(personFailure(401, null), { signedOut: true });
  assert.equal(personFailure(403, { detail: "You can't change this person's account here." }).error,
    "You can't change this person's account here.");
  assert.equal(personFailure(404, null).error, "This person couldn't be found.");
  const failure = personFailure(400, { username: ["Someone already has this username."], detail: "Odd." });
  assert.equal(failure.fields.username, "Someone already has this username.");
  assert.equal(failure.error, "Odd.");
  assert.match(personFailure(0, null).error, /try again/);
});

test("people are described plainly", () => {
  assert.equal(
    personSummary({ role_label: "Content Editor", branch_name: "Chilanga", is_active: true, must_change_password: true, two_factor_enabled: false }),
    "Content Editor · Chilanga · Hasn't chosen their own password yet",
  );
  assert.equal(
    personSummary({ role_label: "Branch Admin", branch_name: "", is_active: false, must_change_password: false, two_factor_enabled: true }),
    "Branch Admin · Suspended · Two-step login on",
  );
  // Suspended says enough; their password isn't the point then.
  assert.equal(
    personSummary({ role_label: "Content Editor", branch_name: "Chilanga", is_active: false, must_change_password: true, two_factor_enabled: false }),
    "Content Editor · Chilanga · Suspended",
  );
});

test("branch forms", () => {
  const data = form({ name: " Kabwe ", slug: " Kabwe ", contact_email: "k@example.org", youtube_channel_id: " UCx ", is_active: "on" });
  assert.deepEqual(branchFromForm(data, { isNew: true }), {
    name: "Kabwe", slug: "Kabwe", contact_email: "k@example.org", youtube_channel_id: "UCx",
  });
  assert.deepEqual(branchFromForm(data, { isNew: false }), {
    name: "Kabwe", contact_email: "k@example.org", youtube_channel_id: "UCx", is_active: true,
  });
  assert.equal(branchFromForm(form({ name: "K" }), { isNew: false }).is_active, false);
  assert.equal(branchFailure(400, { slug: ["Taken."] }).fields.slug, "Taken.");
});

test("history lines read as sentences", () => {
  assert.equal(
    changeSummary({ username: "grace", action: "changed", section: "projects", target: "Roof", changes: ["progress", "start_date"] }),
    "grace changed the project “Roof”: progress, start date",
  );
  assert.equal(
    changeSummary({ username: "boss", action: "suspended", section: "people", target: "newbie", changes: [] }),
    "boss suspended the account “newbie”",
  );
  assert.equal(
    changeSummary({ username: "boss", action: "changed", section: "pages", target: "home", changes: ["tagline"] }),
    "boss changed the page “home”: tagline",
  );
  assert.equal(
    changeSummary({ username: "grace", action: "password reset", section: "people", target: "newbie", changes: [] }),
    "grace reset the password of the account “newbie”",
  );
  assert.equal(
    changeSummary({ username: "grace", action: "set-password link made", section: "people", target: "newbie", changes: [] }),
    "grace made a set-password link for the account “newbie”",
  );
  assert.equal(
    changeSummary({ username: "boss", action: "two-step login reset", section: "people", target: "admin", changes: [] }),
    "boss reset two-step login for the account “admin”",
  );
  assert.equal(
    changeSummary({ username: "boss", action: "changed", section: "branches", target: "Kabwe", changes: ["is_active", "youtube_channel_id"] }),
    "boss changed the branch “Kabwe”: shown on the website, YouTube channel",
  );
  assert.equal(
    changeSummary({ username: "x", action: "added", section: "something-new", target: "T", changes: [] }),
    "x added “T”",
  );
});

test("only safe filters reach the API", () => {
  assert.equal(historyQuery({}), "?page=1");
  assert.equal(historyQuery({ page: "2", branch: "chilanga", person: " grace ", section: "projects" }),
    "?page=2&branch=chilanga&person=grace&section=projects");
  assert.equal(historyQuery({ branch: "../x", section: "nope", page: "x" }), "?page=1");
});

// Task 7.1: a minister's account is linked to their minister profile, by superusers only.
test("superusers choose the minister an account belongs to, or none", () => {
  const base = { username: "rev", role: "branch_admin", branch: "alpha" };
  assert.equal(personFromForm(form({ ...base, minister: "7" }), { superuser: true, isNew: true }).minister, 7);
  assert.equal(personFromForm(form({ ...base, minister: "" }), { superuser: true, isNew: false }).minister, null);
  assert.equal("minister" in personFromForm(form({ ...base, minister: "7" }), { superuser: false, isNew: true }), false);
  assert.deepEqual(personFailure(400, { minister: ["This minister already has an account."] }).fields, {
    minister: "This minister already has an account.",
  });
});

test("ministers are offered by branch, saying which already have an account", () => {
  const groups = ministerGroups(
    [
      { id: 1, name: "Banda", branch: "alpha", account_username: "" },
      { id: 2, name: "Mwale", branch: "alpha", account_username: "mwale" },
      { id: 3, name: "Phiri", branch: "beta", account_username: "rev" },
    ],
    [{ slug: "alpha", name: "Alpha" }, { slug: "beta", name: "Beta" }],
    "rev",
  );
  assert.deepEqual(groups, [
    { label: "Alpha", options: [{ value: "1", label: "Banda" }, { value: "2", label: "Mwale (has an account)" }] },
    { label: "Beta", options: [{ value: "3", label: "Phiri" }] },
  ]);
});

test("a linked account says whose it is", () => {
  assert.equal(
    personSummary({ role_label: "Branch Admin", branch_name: "Alpha", is_active: true, minister_name: "Banda" }),
    "Branch Admin · Alpha · Minister: Banda",
  );
});
