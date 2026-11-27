import { test } from "node:test";
import assert from "node:assert/strict";
import { filterHymns, sortHymns } from "../src/lib/hymns.js";
import { hymnCollectionsResource, hymnsResource } from "../src/lib/resources.js";

const COLLECTIONS = {
  collections: [
    { collection: "tumbuka", label: "Tumbuka Hymns", count: 2 },
    { collection: "chewa", label: "Chewa Hymns", count: 0 },
    { collection: "english", label: "English Hymns", count: 1 },
  ],
};
const ENGLISH = {
  collection: "english",
  hymns: [
    { id: 2, collection: "english", number: 2, title: "Rock of Ages", verses: ["v1"], chorus: "c", notes: "" },
    { id: 1, collection: "english", number: 1, title: "Amazing Grace", verses: ["a", "b"], chorus: "", notes: "1779" },
  ],
};

test("hymnCollectionsResource: key, path and validate (bad payload refused)", () => {
  const r = hymnCollectionsResource();
  assert.equal(r.key, "hymn-collections");
  assert.equal(r.path, "/app/hymns/collections/");
  assert.equal(r.maxAgeMs, 24 * 60 * 60_000);
  assert.equal(r.validate(COLLECTIONS), true);
  assert.equal(r.validate({ nope: 1 }), false);
  assert.equal(r.validate(null), false);
});

test("hymnsResource: key, path and validate (wrong collection refused)", () => {
  const r = hymnsResource("english");
  assert.equal(r.key, "hymns.english");
  assert.equal(r.path, "/app/hymns/?collection=english");
  assert.equal(r.validate(ENGLISH), true);
  assert.equal(r.validate({ ...ENGLISH, collection: "tumbuka" }), false);
  assert.equal(r.validate({ collection: "english" }), false);
});

test("search matches title or number; list sorts by number then title", () => {
  const hymns = ENGLISH.hymns;
  assert.deepEqual(filterHymns(hymns, "grace").map((h) => h.id), [1]);
  assert.deepEqual(filterHymns(hymns, "2").map((h) => h.id), [2]);
  assert.equal(filterHymns(hymns, "").length, 2);
  assert.deepEqual(filterHymns(hymns, "zzz"), []);
  assert.deepEqual(sortHymns(hymns).map((h) => h.number), [1, 2]);
  assert.deepEqual(sortHymns([{ number: 3, title: "B" }, { number: 3, title: "A" }]).map((h) => h.title), ["A", "B"]);
});
