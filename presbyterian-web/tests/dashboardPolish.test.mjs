// The dashboard polish layer (owner's request, 2026-11-09), from the apple-design and
// motionsites-web-builder guidance, matching the public site's polish layer.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../app/dashboard/dashboard.css", import.meta.url), "utf8");
const layer = css.slice(css.indexOf("===== Polish layer"));
const has = (pattern) => assert.match(layer, pattern);

test("the polish layer exists and comes last", () => {
  assert.ok(css.includes("===== Polish layer"));
  assert.ok(layer.length > 1500);
});

test("buttons, rows, cards and menu items answer the moment they are pressed", () => {
  has(/\.dash \.btn-primary:active[^{]*\{[^}]*transform: scale\(0\.9[6-8]\)/);
  has(/\.dash-card-link:active/);
  has(/\.dash-rows a:active/);
  has(/transition: transform 120ms/);
});

test("the phone top bar and save bar are frosted, with a solid fallback", () => {
  has(/div\.dash-topbar \{[^}]*\n  backdrop-filter: blur\(\d+px\) saturate\(1\d0%\)/);
  has(/div\.dash-savebar \{[^}]*\n  backdrop-filter: blur\(\d+px\)/);
  has(/prefers-reduced-transparency: reduce[\s\S]*div\.dash-topbar[\s\S]*backdrop-filter: none/);
});

test("the phone menu slides like a sheet and the dimmer fades in", () => {
  has(/\.dash-sidebar \{[^}]*transition: transform 0\.3\ds cubic-bezier\(0\.32, 0\.72, 0, 1\)/);
  has(/\.dash-scrim \{[^}]*animation: dash-fade/);
});

test("numbers line up and headings balance", () => {
  has(/font-variant-numeric: tabular-nums/);
  has(/text-wrap: balance/);
});

test("the confirm dialog materialises, and reduced motion and contrast are honoured", () => {
  has(/\.dash-dialog\[open\] \{[^}]*animation: dash-materialise/);
  has(/prefers-reduced-motion: reduce[\s\S]*animation: none/);
  has(/prefers-contrast: more/);
});
