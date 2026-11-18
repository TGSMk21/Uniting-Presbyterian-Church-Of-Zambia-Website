import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const tokens = readFileSync(new URL("../src/design/tokens.css", import.meta.url), "utf8");
const appCss = readFileSync(new URL("../src/design/app.css", import.meta.url), "utf8");
const baseCss = readFileSync(new URL("../src/design/base.css", import.meta.url), "utf8");
const design = readFileSync(new URL("../DESIGN.md", import.meta.url), "utf8");

function block(css, selector) {
  const match = css.match(new RegExp(`${selector.replace(/[.*[\]]/g, "\\$&")}\\s*\\{([^}]*)\\}`));
  return match ? match[1] : "";
}

function token(css, name) {
  return css.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`))?.[1];
}

function luminance(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const f = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const light = block(tokens, ":root");
const dark = block(tokens, ':root[data-theme="dark"]');

for (const [name, css] of [["light", light], ["dark", dark]]) {
  test(`${name}: text and brand colours meet WCAG AA (4.5:1) on paper and surfaces`, () => {
    const paper = token(css, "paper");
    const surface = token(css, "surface");
    for (const pair of [
      ["ink", paper], ["ink-2", paper], ["ink-3", paper], ["ink-3", surface],
      ["brand", paper], ["on-brand", token(css, "brand")],
      ["on-accent", token(css, "accent")],
    ]) {
      const fg = token(css, pair[0]);
      assert.ok(fg, `${name} --${pair[0]} missing`);
      const ratio = contrast(fg, pair[1]);
      assert.ok(ratio >= 4.5, `${name} --${pair[0]} on ${pair[1] === paper ? "paper" : pair[1] === surface ? "surface" : pair[1]}: ${ratio.toFixed(2)} < 4.5`);
    }
  });
}

test("the tokens carry the approved design page's colours", () => {
  for (const hex of ["#f6f3ec", "#0d1017", "#1b2a6b", "#b3c3f2", "#c0322a", "#ea6b61"]) {
    assert.ok(tokens.includes(hex), `tokens.css lost ${hex} from DESIGN.md`);
    assert.ok(design.includes(hex), `DESIGN.md lost ${hex}`);
  }
});

test("flat colours only: no gradients anywhere in the app's stylesheets", () => {
  for (const css of [tokens, baseCss, appCss]) {
    assert.ok(!/linear-gradient|radial-gradient/.test(css), "gradient found — the design is flat colours");
  }
});

test("every touch target is at least 48 px", () => {
  assert.match(block(tokens, ":root"), /--touch:\s*48px/);
});
