// The crest palette (owner's request, 2026-11-09): colours come only from the crest,
// with no navy-to-red gradients, glows or pink. Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const css = read("app/globals.css");
const lightTokens = css.slice(css.indexOf(":root {"), css.indexOf("}", css.indexOf(":root {")));
const block = css.slice(css.indexOf("===== Crest palette"));
const token = (name) => lightTokens.match(new RegExp(`${name}:\\s*([^;]+);`))?.[1];

test("navy and red are the crest's own colours", () => {
  assert.equal(token("--navy"), "#182868");
  assert.equal(token("--red"), "#c62828");
  assert.equal(token("--heading"), "#182868");
  assert.equal(token("--action"), "#182868");
  assert.match(read("app/dashboard/dashboard.css"), /--d-brand: #182868;/);
  for (const map of ["components/LocatorComponents/church-map.js", "components/AboutComponents/branch-map.js", "components/DashboardComponents/position-map.js"]) {
    assert.match(read(map), /const NAVY = "#182868";/, map);
  }
});

test("the crest palette block comes last and removes the gradients, glows and pink", () => {
  assert.ok(css.lastIndexOf("===== Crest palette") > css.lastIndexOf("===== Polish layer"));
  assert.match(block, /\.page-banner, \.live-card, \.mission-card, \.nat-closing \{ background: var\(--navy\); \}/);
  assert.match(block, /\.daily-verse \{ background: var\(--navy-deep\); \}/);
  assert.match(block, /\.page-banner::before, \.page-banner::after[^{]*\{ display: none; \}/);
  assert.match(block, /\.hero-slide \{ background: var\(--navy\); \}/);
  assert.doesNotMatch(block, /f58a96|#2a1838|radial-gradient/);
});

test("italic words are a lighter navy, never red or pink", () => {
  assert.match(block, /\.section-title em[^{]*\{ color: var\(--em\); \}/);
  assert.match(block, /\.hero-slide-title em[^{]*\{ color: #c9d3f5; \}/);
  assert.ok(token("--em"));
});

test("red is a small accent on the banner, and its button is warm paper", () => {
  assert.match(block, /\.hero-slide-copy::before \{[^}]*height: 3px;[^}]*background: var\(--red\)/);
  assert.match(block, /\.hero-carousel \.btn-primary \{ background: #faf6ee; color: #182868; \}/);
});
