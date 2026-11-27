import { test } from "node:test";
import assert from "node:assert/strict";
import { memoryBlobs, webBlobs } from "../src/lib/blobStore.js";

test("memoryBlobs: round trip, missing key is null, clear() empties everything", async () => {
  const blobs = memoryBlobs();
  assert.equal(await blobs.get("home.chilanga"), null);
  await blobs.set("home.chilanga", { at: 5, data: { hello: "world" } });
  assert.deepEqual(await blobs.get("home.chilanga"), { at: 5, data: { hello: "world" } });
  await blobs.set("events.kanyama", { at: 6, data: [] });
  assert.equal(blobs.store.size, 2);
  await blobs.clear();
  assert.equal(await blobs.get("home.chilanga"), null);
  assert.equal(blobs.store.size, 0);
});

test("bad cache keys throw (memory and web)", async () => {
  // Give node a localStorage so webBlobs can be exercised here too.
  const backing = new Map();
  globalThis.localStorage = {
    get length() { return backing.size; },
    key: (i) => [...backing.keys()][i] ?? null,
    getItem: (k) => (backing.has(k) ? backing.get(k) : null),
    setItem: (k, v) => backing.set(k, String(v)),
    removeItem: (k) => backing.delete(k),
  };
  for (const blobs of [memoryBlobs(), webBlobs()]) {
    for (const bad of ["../x", "A", "", "UPPER", "with space", "slash/inside"]) {
      await assert.rejects(() => blobs.get(bad), /bad cache key/);
      await assert.rejects(() => blobs.set(bad, {}), /bad cache key/);
    }
    // and a good key still works afterwards
    await blobs.set("home.chilanga", { at: 1, data: 1 });
    assert.deepEqual(await blobs.get("home.chilanga"), { at: 1, data: 1 });
  }
});
