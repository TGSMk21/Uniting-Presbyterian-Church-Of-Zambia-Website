// Light, dark and follow-the-phone (MOBILE_APP_PLAN.md, Phase 0).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { THEME_COLORS, THEME_KEY, THEME_PREFS, readPref, resolveTheme } from "../src/lib/theme.js";

test("the phone's setting is followed unless the person chose", () => {
  assert.equal(resolveTheme("system", true), "dark");
  assert.equal(resolveTheme("system", false), "light");
  assert.equal(resolveTheme("light", true), "light");
  assert.equal(resolveTheme("dark", false), "dark");
});

test("a stored choice is only trusted if it's one of the three", () => {
  const store = (value) => ({ getItem: () => value });
  assert.equal(readPref(store("dark")), "dark");
  assert.equal(readPref(store("purple")), "system");
  assert.equal(readPref(store(null)), "system");
  assert.equal(readPref({ getItem: () => { throw new Error("blocked"); } }), "system");
  assert.deepEqual(THEME_PREFS, ["system", "light", "dark"]);
});

test("the page sets the theme before the first paint with the same key and colours", () => {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  assert.ok(html.includes(`localStorage.getItem("${THEME_KEY}")`));
  assert.ok(html.includes(THEME_COLORS.dark) && html.includes(THEME_COLORS.light));
  const config = JSON.parse(readFileSync(new URL("../capacitor.config.json", import.meta.url), "utf8"));
  assert.equal(config.android.backgroundColor, THEME_COLORS.light);
});
