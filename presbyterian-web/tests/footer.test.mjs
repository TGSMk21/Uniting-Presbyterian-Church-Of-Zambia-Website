// The site footer (owner's requests, 2026-11-08). Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const footer = readFileSync(new URL("../components/UniversalComponents/footer-client.js", import.meta.url), "utf8");

test("the navy footer uses the crest without its white glow", () => {
  assert.ok(existsSync(new URL("../public/crest.png", import.meta.url)));
  assert.match(footer, /<CrestLogo className="footer-crest" \/>/);
  assert.doesNotMatch(footer, /brand\.logo/);
});

test("the footer doesn't show a phone number", () => {
  assert.doesNotMatch(footer, /contact\?\.phone|tel:/);
});
