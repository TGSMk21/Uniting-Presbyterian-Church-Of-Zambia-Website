// "My branch": a member picks their branch once and the main link takes them there
// (owner's request, 2026-11-08). Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  BRANCH_COOKIE, STAY_COOKIE, branchCookie, homeRedirect, isBranchSlug, readBranchCookie,
} from "../Utilities/myBranch.mjs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("only real-looking branch addresses are accepted", () => {
  for (const good of ["chilanga", "st-columbus-kabwe", "a1"]) assert.equal(isBranchSlug(good), true, good);
  for (const bad of ["", "Chilanga", "../x", "a/b", "a b", "dashboard?x", "-x", "x".repeat(80), null, undefined, 5]) {
    assert.equal(isBranchSlug(bad), false, String(bad));
  }
});

test("the choice is read from the browser's cookies, and rubbish is ignored", () => {
  assert.equal(readBranchCookie(`a=1; ${BRANCH_COOKIE}=chilanga; b=2`), "chilanga");
  assert.equal(readBranchCookie(`${BRANCH_COOKIE}=%2E%2E%2Fevil`), null);
  assert.equal(readBranchCookie(`${BRANCH_COOKIE}=`), null);
  assert.equal(readBranchCookie("other=1"), null);
  assert.equal(readBranchCookie(""), null);
  assert.equal(readBranchCookie(undefined), null);
});

test("the cookie lasts a year, covers the whole site, and holds nothing personal", () => {
  const cookie = branchCookie("chilanga", { secure: true });
  assert.match(cookie, /^upcz-branch=chilanga;/);
  assert.match(cookie, /Max-Age=31536000/);
  assert.match(cookie, /Path=\//);
  assert.match(cookie, /SameSite=Lax/);
  assert.match(cookie, /Secure/);
  assert.doesNotMatch(branchCookie("chilanga", { secure: false }), /Secure/);
  assert.throws(() => branchCookie("../x"));
});

test("the main link goes to the member's branch, unless they asked for the whole church", () => {
  assert.equal(homeRedirect({ branch: "chilanga" }), "/chilanga");
  assert.equal(homeRedirect({ branch: null }), null);
  // "Church-wide site" (?all) and the rest of that visit are left alone.
  assert.equal(homeRedirect({ branch: "chilanga", all: true }), null);
  assert.equal(homeRedirect({ branch: "chilanga", stay: true }), null);
  // A tampered cookie never becomes a redirect.
  assert.equal(homeRedirect({ branch: "../evil" }), null);
  assert.equal(STAY_COOKIE, "upcz-stay");
});

test("the proxy only redirects the home address and never caches that answer", () => {
  const proxy = read("proxy.js");
  assert.match(proxy, /matcher: \["\/", "\/dashboard\/:path\*"\]/);
  assert.match(proxy, /request\.nextUrl\.pathname === "\/"/);
  assert.match(proxy, /homeRedirect\(/);
  assert.match(proxy, /no-store/);
  assert.match(proxy, /STAY_COOKIE/);
  // A background prefetch of "Church-wide site" must not switch the redirect off.
  assert.match(proxy, /next-router-prefetch/);
  assert.equal((read("components/UniversalComponents/my-branch.js").match(/href="\/\?all=1" prefetch=\{false\}/g) || []).length, 2);
});

test("branch pages, the branch finder and the national pages let people choose", () => {
  assert.match(read("app/[branch]/layout.js"), /<MyBranchBar /);
  assert.match(read("app/[branch]/layout.js"), /<MyBranchPrompt /);
  assert.match(read("app/(national)/layout.js"), /<BranchPicker /);
  assert.match(read("components/LocatorComponents/church-locator.js"), /<MakeMyBranch /);
  // A removed branch can't trap anyone: "Back to home" skips the redirect.
  assert.match(read("app/not-found.js"), /href="\/\?all=1"/);
  const ui = read("components/UniversalComponents/my-branch.js");
  assert.match(ui, /Church-wide site/);
  assert.match(ui, /Make \{name\} my branch/);
});
