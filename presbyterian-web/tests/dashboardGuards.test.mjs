// Every dashboard page checks who is signed in (AGENT_EXECUTION_PLAN.md, Task 5.5). Run: npm test
// The API refuses anything a person may not do; these checks make the pages agree,
// so nobody sees a screen they can't use.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const STAFF = fileURLToPath(new URL("../app/dashboard/(staff)", import.meta.url));

function files(dir, name) {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return files(path, name);
    return entry === name ? [path] : [];
  });
}

const where = (path) => relative(STAFF, path).replaceAll("\\", "/");

test("every signed-in page asks who is signed in", () => {
  const pages = files(STAFF, "page.js");
  assert.ok(pages.length >= 15, `only found ${pages.length} pages`);
  for (const page of pages) {
    assert.match(readFileSync(page, "utf8"), /await requireStaff\(/, where(page));
  }
});

test("staff pages are for branch admins and superusers only", () => {
  for (const page of files(join(STAFF, "staff"), "page.js")) {
    assert.match(readFileSync(page, "utf8"), /if \(!canManageStaff\(staff\)\) notFound\(\);/, where(page));
  }
});

test("access requests are for branch admins and superusers only", () => {
  const pages = files(join(STAFF, "requests"), "page.js");
  assert.ok(pages.length >= 2);
  for (const page of pages) {
    assert.match(readFileSync(page, "utf8"), /if \(!canManageStaff\(staff\)\) notFound\(\);/, where(page));
  }
});

test("the pages for people without an account stay outside the signed-in area", () => {
  for (const page of ["request-access", "set-password"]) {
    const path = fileURLToPath(new URL(`../app/dashboard/${page}/page.js`, import.meta.url));
    assert.doesNotMatch(readFileSync(path, "utf8"), /requireStaff\(/, page);
  }
});

test("branches and the change history are for superusers only", () => {
  const pages = [...files(join(STAFF, "branches"), "page.js"), ...files(join(STAFF, "history"), "page.js")];
  assert.ok(pages.length >= 4);
  for (const page of pages) {
    assert.match(readFileSync(page, "utf8"), /if \(!staff\.is_superuser\) notFound\(\);/, where(page));
  }
});

test("downloads check who is signed in too", () => {
  const routes = files(STAFF, "route.js");
  assert.ok(routes.length >= 2);
  for (const route of routes) {
    assert.match(readFileSync(route, "utf8"), /exportResponse\(/, where(route));
  }
});

test("pages only show what the API returned for this person", () => {
  // Pages that list or open branch rows take them from staffRequest (the person's own
  // session), never from the public API, which knows nothing about who is asking.
  for (const page of files(join(STAFF, "content"), "page.js")) {
    const source = readFileSync(page, "utf8");
    if (/staffRequest\(/.test(source)) {
      assert.match(source, /status === 401\) redirect\("\/dashboard\/login"\)/, where(page));
      assert.match(source, /status === 403 \|\| status === 404\) notFound\(\)/, where(page));
    }
  }
});

test("the site doesn't announce what it's built with", () => {
  const config = readFileSync(new URL("../next.config.mjs", import.meta.url), "utf8");
  assert.match(config, /poweredByHeader: false/);
});
