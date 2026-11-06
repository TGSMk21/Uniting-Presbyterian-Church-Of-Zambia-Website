// Visitor analytics (AGENT_EXECUTION_PLAN.md, Phase 6). Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const layout = readFileSync(new URL("../app/layout.js", import.meta.url), "utf8");

test("the root layout loads analytics, so the national site and every branch are counted", () => {
  assert.match(layout, /from "@vercel\/analytics\/next"/);
  const body = layout.slice(layout.indexOf("<body"), layout.indexOf("</body>"));
  assert.match(body, /<Analytics\s*\/>/);
});
