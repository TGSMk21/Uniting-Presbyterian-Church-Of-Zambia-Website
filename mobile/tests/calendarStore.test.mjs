import { test } from "node:test";
import assert from "node:assert/strict";
import { memoryPrefs } from "../src/lib/storage.js";
import { readAdded, toggleAdded, toggleId, writeAdded } from "../src/lib/calendarStore.js";
import { needsBatteryGuide } from "../src/lib/phoneMake.js";

test("toggleId adds and removes, as strings", () => {
  assert.deepEqual(toggleId([], 7), ["7"]);
  assert.deepEqual(toggleId(["7"], 7), []);
  assert.deepEqual(toggleId(["7"], "8"), ["7", "8"]);
});

test("added events persist on the phone and survive a bad stored value", async () => {
  const prefs = memoryPrefs();
  assert.deepEqual(await readAdded(prefs), []);
  let list = await toggleAdded(prefs, 7);
  assert.deepEqual(list, ["7"]);
  list = await toggleAdded(prefs, 8);
  assert.deepEqual(list, ["7", "8"]);
  assert.deepEqual(await readAdded(memoryPrefs({ "upcz.addedEvents": "{oops" })), []);
  prefs.store["upcz.addedEvents"] = JSON.stringify({ nope: true });
  assert.deepEqual(await readAdded(prefs), []);
  await writeAdded(prefs, ["1", "2"]);
  assert.deepEqual(await readAdded(prefs), ["1", "2"]);
});

test("phones that limit background reminders are detected from the user agent", () => {
  assert.equal(needsBatteryGuide("Mozilla/5.0 (Linux; Android 13) Tecno Spark 20"), true);
  assert.equal(needsBatteryGuide("Mozilla/5.0 (Linux; Android 12) INFINIX X6525"), true);
  assert.equal(needsBatteryGuide("Mozilla/5.0 (Linux; Android 14) Xiaomi 2210132C"), true);
  assert.equal(needsBatteryGuide("Mozilla/5.0 (Linux; Android 14) Redmi Note 13"), true);
  assert.equal(needsBatteryGuide("Mozilla/5.0 (Linux; Android 15) Samsung SM-S918B"), false);
  assert.equal(needsBatteryGuide("Mozilla/5.0 (Linux; Android 15) Pixel 8"), false);
  assert.equal(needsBatteryGuide(""), false);
});
