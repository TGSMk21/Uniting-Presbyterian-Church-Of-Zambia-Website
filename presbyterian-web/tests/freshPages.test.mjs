// Pages must not freeze a failed API call into the site (AGENT_EXECUTION_PLAN.md, Phase 6).
//
// A page prerendered at build time keeps whatever the API returned then. If the
// backend is restarting, which happens when a push deploys both sides together,
// that page goes out empty and stays empty until its cache expires.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const APP = new URL("../app/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

function pages(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return pages(path);
    return entry.name === "page.js" ? [path] : [];
  });
}

// A dynamic [segment] in the path already means the page renders on request.
const prerendered = pages(APP).filter((path) => !path.slice(APP.length).includes("["));

test("the check can see the pages it guards", () => {
  const names = prerendered.map((path) => path.replaceAll("\\", "/"));
  assert.ok(names.some((name) => name.endsWith("(national)/page.js")));
  assert.ok(names.some((name) => name.endsWith("(national)/find-a-branch/page.js")));
});

test("any page without a [segment] that reads the API renders on request", () => {
  for (const path of prerendered) {
    const source = readFileSync(path, "utf8");
    if (!source.includes("@/Services/api")) continue;
    // requireStaff reads the sign-in cookies, which also makes a page render on request.
    assert.match(source, /await (connection|requireStaff)\(/, `${path} would be frozen at build time`);
  }
});

test("Find a Branch doesn't say there are no branches when it just couldn't load them", () => {
  const source = readFileSync(join(APP, "(national)", "find-a-branch", "page.js"), "utf8");
  assert.match(source, /couldn.{1,6}t load/i);
});
