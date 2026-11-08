// Finding the visitor for "Find the nearest to me" (owner's report, 2026-11-08:
// the tablet said it couldn't get the location). Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { locate, locationMessage } from "../Utilities/locate.mjs";

function fakeGeo(results) {
  const calls = [];
  return {
    calls,
    getCurrentPosition(ok, fail, options) {
      calls.push(options);
      const next = results.shift();
      if (next.code) fail(next); else ok({ coords: next });
    },
  };
}

test("a position comes back as lat and lng", async () => {
  const geo = fakeGeo([{ latitude: -15.4, longitude: 28.3 }]);
  assert.deepEqual(await locate(geo), { lat: -15.4, lng: 28.3 });
  // A recent position is fine, and it doesn't give up too soon.
  assert.ok(geo.calls[0].maximumAge >= 5 * 60 * 1000);
  assert.ok(geo.calls[0].timeout >= 15000);
});

test("a slow first try is tried again with the device's precise location", async () => {
  const geo = fakeGeo([{ code: 3 }, { latitude: 1, longitude: 2 }]);
  assert.deepEqual(await locate(geo), { lat: 1, lng: 2 });
  assert.equal(geo.calls.length, 2);
  assert.equal(geo.calls[1].enableHighAccuracy, true);
});

test("a refusal isn't asked again", async () => {
  const geo = fakeGeo([{ code: 1 }]);
  await assert.rejects(locate(geo), (error) => error.code === 1);
  assert.equal(geo.calls.length, 1);
});

test("no browser support is its own failure", async () => {
  await assert.rejects(locate(undefined), (error) => error.code === "unsupported");
});

test("each failure says what to do about it", () => {
  assert.match(locationMessage(1), /blocked/i);
  assert.match(locationMessage(1), /site settings|address bar/i);
  assert.match(locationMessage(2), /turned on/i);
  assert.match(locationMessage(3), /took too long/i);
  assert.match(locationMessage("unsupported"), /can't share/i);
  for (const code of [1, 2, 3, "unsupported", undefined]) assert.match(locationMessage(code), /town/i);
});
