// Light and dark themes, following the device unless a visitor picks one
// (owner's request, 2026-11-08). Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { THEMES, THEME_KEY, nextTheme, readTheme, themeScript } from "../Utilities/theme.mjs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

function runScript(stored, { throws = false } = {}) {
  const attributes = {};
  const document = { documentElement: { setAttribute: (name, value) => { attributes[name] = value; } } };
  const localStorage = { getItem: (key) => { if (throws) throw new Error("blocked"); return key === THEME_KEY ? stored : null; } };
  new Function("document", "localStorage", themeScript)(document, localStorage);
  return attributes["data-theme"];
}

test("the device's own setting is the default, then light, then dark", () => {
  assert.deepEqual(THEMES, ["system", "light", "dark"]);
  assert.equal(readTheme(null), "system");
  assert.equal(readTheme("nonsense"), "system");
  assert.equal(readTheme("dark"), "dark");
  assert.equal(nextTheme("system"), "light");
  assert.equal(nextTheme("light"), "dark");
  assert.equal(nextTheme("dark"), "system");
});

test("the early script applies a saved choice before the page is drawn", () => {
  assert.equal(runScript("dark"), "dark");
  assert.equal(runScript("light"), "light");
  // With no choice, or storage blocked, the stylesheet follows the device.
  assert.equal(runScript(null), undefined);
  assert.equal(runScript("purple"), undefined);
  assert.equal(runScript("dark", { throws: true }), undefined);
});

test("the root layout runs the script in the head", () => {
  const layout = read("app/layout.js");
  assert.match(layout, /themeScript/);
  assert.match(layout, /<head>/);
  assert.match(layout, /suppressHydrationWarning/);
});

test("the switch is in the website's menu, its phone menu and the dashboard", () => {
  assert.match(read("components/UniversalComponents/nav-client.js"), /<ThemeToggle/g);
  assert.equal(read("components/UniversalComponents/nav-client.js").match(/<ThemeToggle/g).length, 2);
  assert.match(read("components/DashboardComponents/dashboard-shell.js"), /<ThemeToggle/);
});

// Every colour token has a dark value, both when the device asks for dark
// and when a visitor picks it, and a picked light theme beats the device.
function tokenBlock(css, selector) {
  const start = css.indexOf(selector);
  assert.ok(start >= 0, `missing ${selector}`);
  const open = css.indexOf("{", start);
  let depth = 0;
  for (let i = open; i < css.length; i += 1) {
    if (css[i] === "{") depth += 1;
    if (css[i] === "}") { depth -= 1; if (depth === 0) return css.slice(open + 1, i); }
  }
  throw new Error("unclosed block");
}
const names = (block) => new Set([...block.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]));

for (const [file, prefix, base, scope] of [
  ["app/globals.css", "", ":root {", ""],
  ["app/dashboard/dashboard.css", "--d-", ".dash {", " .dash"],
]) {
  test(`${file} has a dark value for every colour`, () => {
    const css = read(file);
    const light = [...names(tokenBlock(css, base))].filter((n) => n.startsWith(prefix || "--"))
      .filter((n) => !/radius|sidebar|shadow-size/.test(n));
    const picked = names(tokenBlock(css, `:root[data-theme="dark"]${scope}`));
    const media = css.slice(css.indexOf("@media (prefers-color-scheme: dark)"));
    assert.ok(css.includes("@media (prefers-color-scheme: dark)"));
    const device = names(tokenBlock(media, `:root:not([data-theme="light"])${scope}`));
    for (const block of [tokenBlock(css, `:root[data-theme="dark"]${scope}`), tokenBlock(media, `:root:not([data-theme="light"])${scope}`)]) {
      const all = [...block.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]);
      assert.equal(all.length, new Set(all).size, "a colour is set twice in one dark block");
    }
    for (const name of light) {
      assert.ok(picked.has(name), `${name} has no picked-dark value`);
      assert.ok(device.has(name), `${name} has no device-dark value`);
    }
    assert.match(css, /color-scheme: light/);
    assert.match(css, /color-scheme: dark/);
  });
}

test("cards and panels use colour tokens instead of plain white", () => {
  const css = read("app/globals.css");
  assert.doesNotMatch(css, /background(-color)?:\s*white/);
  assert.doesNotMatch(css, /^\s*color:\s*var\(--navy\)/m);
});
