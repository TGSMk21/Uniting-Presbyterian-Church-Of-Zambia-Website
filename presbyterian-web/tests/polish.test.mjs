// The design polish layer (owner's request, 2026-11-09), from the apple-design and
// motionsites-web-builder guidance: balanced headings, press feedback, a translucent
// top bar, staggered banner entrance, gentler motion and transparency settings.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const layer = css.slice(css.indexOf("===== Polish layer"));
const has = (pattern, message) => assert.match(layer, pattern, message);

test("the polish layer exists and comes last, so it can be read or removed as one block", () => {
  assert.ok(css.includes("===== Polish layer"));
  assert.ok(layer.length > 1500);
});

test("headings balance their lines, large type is tightened and body text avoids lone words", () => {
  has(/h1, h2, h3[^{]*\{[^}]*text-wrap: balance/);
  has(/\.hero-slide-title[^{]*\{[^}]*letter-spacing: -0\.0[2-4]/);
  has(/p[^{]*\{[^}]*text-wrap: pretty/);
  has(/font-optical-sizing: auto/);
});

test("things react the instant they are pressed, not when released", () => {
  has(/:active[^{]*\{[^}]*transform: scale\(0\.9[5-8]/);
  has(/transition: transform 120ms/);
  has(/-webkit-tap-highlight-color: transparent/);
});

test("the top bar is a translucent material that falls back to solid when asked", () => {
  has(/nav\.nav \{[^}]*\n  backdrop-filter: blur\(\d+px\) saturate\(1[5-9]0%\)/);
  has(/prefers-reduced-transparency: reduce[\s\S]*nav\.nav[\s\S]*backdrop-filter: none/);
});

test("banner words arrive in order and the rest state is visible without scripts", () => {
  has(/\.hero-slide\[data-current\] \.hero-slide-title[^{]*\{[^}]*animation: hero-rise/);
  has(/hero-slide-title \{ animation: hero-rise [^;]* 0\.1s backwards/);
  has(/hero-slide-actions \{ animation: hero-rise [^;]* 0\.3s backwards/);
  has(/@media \(scripting: none\)[\s\S]*\.reveal[^}]*opacity: 1/);
});

test("reduced motion and increased contrast are honoured", () => {
  has(/prefers-reduced-motion: reduce[\s\S]*animation: none/);
  has(/prefers-contrast: more/);
});

test("the branch prompt is a glass layer like the top bar", () => {
  has(/aside\.mybranch-prompt \{[^}]*\n  backdrop-filter: blur\(\d+px\)/);
});
