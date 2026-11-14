// The five tabs, the pages opened on top of them, and the Android back button.
import { test } from "node:test";
import assert from "node:assert/strict";
import { TABS, back, initialNav, openPage, openSheet, selectTab } from "../src/lib/navigation.js";

test("the five tabs, in the owner's order", () => {
  assert.deepEqual(TABS.map((t) => t.id), ["home", "events", "sermons", "hymns", "announcements"]);
  assert.deepEqual(TABS.map((t) => t.label), ["Home", "Events", "Sermons", "Hymns", "Announcements"]);
});

test("choosing a tab closes pages opened on top", () => {
  let nav = openPage(initialNav(), "settings");
  nav = selectTab(nav, "events");
  assert.deepEqual(nav, { ...initialNav(), tab: "events", visited: ["home", "events"] });
});

test("choosing the tab you're on asks it to scroll to the top", () => {
  const nav = selectTab(initialNav(), "home");
  assert.equal(nav.scrollTopTick, 1);
  assert.equal(selectTab(nav, "home").scrollTopTick, 2);
});

test("an unknown tab or page is ignored", () => {
  assert.deepEqual(selectTab(initialNav(), "admin"), initialNav());
  assert.deepEqual(openPage(initialNav(), "admin"), initialNav());
});

test("back closes a sheet, then a page, then returns Home, then leaves the app", () => {
  let nav = openSheet(openPage(selectTab(initialNav(), "events"), "settings"), "event-7");
  let step = back(nav);
  assert.equal(step.nav.sheet, null);
  assert.deepEqual(step.nav.stack, ["settings"]);
  step = back(step.nav);
  assert.deepEqual(step.nav.stack, []);
  assert.equal(step.nav.tab, "events");
  step = back(step.nav);
  assert.equal(step.nav.tab, "home");
  assert.equal(step.leave, false);
  step = back(step.nav);
  assert.equal(step.leave, true);
});

test("a page isn't opened twice in a row", () => {
  const nav = openPage(openPage(initialNav(), "profile"), "profile");
  assert.deepEqual(nav.stack, ["profile"]);
});
