// Security headers sent with every page (AGENT_EXECUTION_PLAN.md, Phase 6). Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";

import { contentSecurityPolicy, dashboardHeaders, securityHeaders } from "../Utilities/securityHeaders.mjs";

// "default-src 'self'; img-src a b" → { "default-src": ["'self'"], "img-src": ["a", "b"] }
function directives(policy) {
  return Object.fromEntries(
    policy.split(";").map((d) => {
      const [name, ...values] = d.trim().split(/\s+/);
      return [name, values];
    }),
  );
}

const production = directives(contentSecurityPolicy({ dev: false }));

test("nothing loads from other sites unless a directive allows it", () => {
  assert.deepEqual(production["default-src"], ["'self'"]);
  assert.deepEqual(production["object-src"], ["'none'"]);
  assert.deepEqual(production["base-uri"], ["'self'"]);
  assert.deepEqual(production["form-action"], ["'self'"]);
});

test("no other site can put our pages in a frame", () => {
  assert.deepEqual(production["frame-ancestors"], ["'none'"]);
});

test("sermon videos can play, and YouTube is the only site that can be framed", () => {
  assert.deepEqual(production["frame-src"], ["https://www.youtube.com"]);
});

test("map tiles, thumbnails and uploaded images can load", () => {
  // Uploads may move to a custom domain, so any https image is allowed.
  assert.ok(production["img-src"].includes("https:"));
  assert.ok(production["img-src"].includes("data:"));
  assert.ok(production["img-src"].includes("'self'"));
});

test("scripts come only from this site, and eval is off in production", () => {
  assert.ok(production["script-src"].includes("'self'"));
  assert.ok(!production["script-src"].includes("'unsafe-eval'"));
  assert.ok(!production["script-src"].includes("https:"));
  assert.ok(!production["script-src"].includes("*"));
});

test("next dev keeps working: it needs eval and its reload socket", () => {
  const dev = directives(contentSecurityPolicy({ dev: true }));
  assert.ok(dev["script-src"].includes("'unsafe-eval'"));
  assert.ok(dev["connect-src"].some((source) => source.startsWith("ws:")));
  assert.ok(!production["connect-src"].some((source) => source.startsWith("ws:")));
});

test("analytics runs from our own domain, so only next dev allows Vercel's script host", () => {
  const dev = directives(contentSecurityPolicy({ dev: true }));
  assert.ok(dev["script-src"].includes("https://va.vercel-scripts.com"));
  assert.ok(!production["script-src"].includes("https://va.vercel-scripts.com"));
});

test("dashboard pages stay out of search engines and shared caches", () => {
  const headers = Object.fromEntries(dashboardHeaders().map((h) => [h.key, h.value]));
  assert.match(headers["X-Robots-Tag"], /noindex/);
  assert.match(headers["Cache-Control"], /no-store/);
  assert.match(headers["Cache-Control"], /private/);
});

test("every page gets the full set of headers", () => {
  const headers = Object.fromEntries(securityHeaders({ dev: false }).map((h) => [h.key, h.value]));
  assert.equal(headers["Content-Security-Policy"], contentSecurityPolicy({ dev: false }));
  assert.equal(headers["X-Frame-Options"], "DENY");
  assert.equal(headers["X-Content-Type-Options"], "nosniff");
  assert.match(headers["Strict-Transport-Security"], /max-age=\d{8}/);
});

test("the referrer policy doesn't break YouTube embeds, which need the site's origin", () => {
  const headers = Object.fromEntries(securityHeaders({ dev: false }).map((h) => [h.key, h.value]));
  assert.equal(headers["Referrer-Policy"], "strict-origin-when-cross-origin");
});

test("Find a Branch can still ask for location; camera and microphone are off", () => {
  const headers = Object.fromEntries(securityHeaders({ dev: false }).map((h) => [h.key, h.value]));
  assert.match(headers["Permissions-Policy"], /geolocation=\(self\)/);
  assert.match(headers["Permissions-Policy"], /camera=\(\)/);
  assert.match(headers["Permissions-Policy"], /microphone=\(\)/);
});
