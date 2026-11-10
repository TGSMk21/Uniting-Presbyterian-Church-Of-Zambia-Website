// The crest with its motto everywhere (owner's request, 2026-11-08). Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { DEFAULT_LOGO, MOTTO, isOwnLogo } from "../Utilities/crest.mjs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("the crest picture has no white glow file of its own and the motto is text", () => {
  assert.ok(existsSync(new URL("../public/crest.png", import.meta.url)));
  assert.ok(!existsSync(new URL("../public/logo-on-dark.png", import.meta.url)));
  assert.equal(MOTTO, "Nec tamen consumebatur");
  const component = read("components/UniversalComponents/crest-logo.js");
  assert.match(component, /src="\/crest\.png"/);
  assert.match(component, /className="crest-motto"/);
});

test("the standard logo shows as the crest; a branch's uploaded logo shows as uploaded", () => {
  assert.equal(isOwnLogo(DEFAULT_LOGO), false);
  assert.equal(isOwnLogo(null), false);
  assert.equal(isOwnLogo("https://media.example.org/logos/chilanga.webp"), true);
});

test("every place that showed the logo uses the crest", () => {
  const places = [
    "components/UniversalComponents/nav-client.js",
    "components/UniversalComponents/footer-client.js",
    "components/DashboardComponents/dashboard-shell.js",
    "app/dashboard/login/page.js",
    "app/dashboard/set-password/page.js",
    "app/dashboard/request-access/page.js",
  ];
  for (const path of places) {
    const code = read(path);
    assert.match(code, /<CrestLogo/, path);
    assert.doesNotMatch(code, /src="\/logo\.png"|logo-on-dark/, path);
  }
  // The header shows a branch's own logo when it has one.
  assert.match(read("components/UniversalComponents/nav-client.js"), /<CrestLogo src=\{brand\.logo\}/);
});

test("the motto takes the theme's colour and stays readable", () => {
  const css = read("app/globals.css");
  assert.match(css, /\.crest \{[^}]*color: var\(--heading\)/);
  assert.match(css, /\.crest-motto \{[^}]*font-size: max\(9px/);
});

test("the phone menu shows the crest too", () => {
  const nav = read("components/UniversalComponents/nav-client.js");
  assert.match(nav, /<CrestLogo src=\{brand\.logo\} className="drawer-crest" \/>/);
  assert.match(read("app/globals.css"), /\.drawer-crest \{[^}]*color: rgba\(255, 255, 255/);
});

// The browser tab, bookmark and home-screen icons are the crest, not the host's default (2026-11-10).
test("the site's icons are the crest", () => {
  for (const file of ["app/favicon.ico", "app/icon.png", "app/apple-icon.png"]) {
    assert.ok(existsSync(new URL(`../${file}`, import.meta.url)), file);
  }
  const png = readFileSync(new URL("../app/icon.png", import.meta.url));
  assert.equal(png.readUInt32BE(16), 512);
  assert.equal(png.readUInt32BE(20), 512);
});
