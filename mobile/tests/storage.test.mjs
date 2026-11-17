import { test } from "node:test";
import assert from "node:assert/strict";
import {
  KEYS, memoryPrefs, readJSON, readFlag, removeKey, writeFlag, writeJSON,
} from "../src/lib/storage.js";

test("keys all start with upcz. so one clear can wipe the app's data", () => {
  for (const key of Object.values(KEYS)) assert.match(key, /^upcz\./);
});

test("readJSON falls back on missing, invalid and blocked storage", async () => {
  const prefs = memoryPrefs();
  assert.deepEqual(await readJSON(prefs, KEYS.profile, null), null);
  prefs.store[KEYS.profile] = "{not json";
  assert.deepEqual(await readJSON(prefs, KEYS.profile, { a: 1 }), { a: 1 });
  const blocked = { get: () => Promise.reject(new Error("blocked")) };
  assert.deepEqual(await readJSON(blocked, KEYS.profile, "fb"), "fb");
});

test("writeJSON then readJSON round-trips, and removeKey clears", async () => {
  const prefs = memoryPrefs();
  await writeJSON(prefs, KEYS.profile, { name: "Mary" });
  assert.deepEqual(await readJSON(prefs, KEYS.profile, null), { name: "Mary" });
  await removeKey(prefs, KEYS.profile);
  assert.equal(await readJSON(prefs, KEYS.profile, null), null);
});

test("flags read as booleans and default to false", async () => {
  const prefs = memoryPrefs();
  assert.equal(await readFlag(prefs, KEYS.seenOpening), false);
  await writeFlag(prefs, KEYS.seenOpening, true);
  assert.equal(await readFlag(prefs, KEYS.seenOpening), true);
  prefs.store[KEYS.seenOpening] = "yes";
  assert.equal(await readFlag(prefs, KEYS.seenOpening), false);
});
