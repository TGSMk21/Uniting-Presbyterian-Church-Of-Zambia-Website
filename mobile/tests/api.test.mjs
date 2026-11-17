import { test } from "node:test";
import assert from "node:assert/strict";
import { KEYS, memoryPrefs } from "../src/lib/storage.js";
import { API_BASE, FALLBACK_BRANCHES, loadBranches, parseBranches } from "../src/lib/api.js";

const okFetch = (payload) => () => Promise.resolve({ ok: true, json: () => Promise.resolve(payload) });
const failFetch = () => () => Promise.reject(new Error("offline"));

test("the API base is the Render service unless the build overrides it", () => {
  assert.match(API_BASE, /^https:\/\//);
  assert.ok(!API_BASE.endsWith("/"));
});

test("parseBranches keeps only real branches, sorted by name, deduped by slug", () => {
  const parsed = parseBranches([
    { slug: "kabwata", name: "Kabwata Presbyterian Church" },
    { slug: "chilanga", name: "Chilanga Presbyterian Church" },
    { name: "no slug" },
    { slug: "x" },
    { slug: "Bad Slug!", name: "Not a real branch" },
    { slug: "chilanga", name: "Chilanga again" },
    "junk",
  ]);
  assert.deepEqual(parsed, [
    { slug: "chilanga", name: "Chilanga Presbyterian Church" },
    { slug: "kabwata", name: "Kabwata Presbyterian Church" },
  ]);
});

test("the fallback is the owner's list of ten main branches", () => {
  assert.equal(FALLBACK_BRANCHES.length, 10);
  assert.ok(FALLBACK_BRANCHES.some((b) => b.slug === "chilanga"));
  for (const b of FALLBACK_BRANCHES) assert.ok(b.slug && b.name);
});

test("a good answer comes from the API and is cached on the phone", async () => {
  const prefs = memoryPrefs();
  const list = [{ slug: "matero", name: "Matero Presbyterian Church" }];
  const result = await loadBranches({ prefs, fetchImpl: okFetch(list), timeoutMs: 50 });
  assert.equal(result.source, "api");
  assert.deepEqual(result.branches, [{ slug: "matero", name: "Matero Presbyterian Church" }]);
  const cached = JSON.parse(prefs.store[KEYS.branches]);
  assert.deepEqual(cached.list, result.branches);
  assert.ok(cached.at > 0);
});

test("when the network fails, the saved list is used", async () => {
  const prefs = memoryPrefs();
  prefs.store[KEYS.branches] = JSON.stringify({ at: 1, list: [{ slug: "kanyama", name: "Kanyama" }] });
  const result = await loadBranches({ prefs, fetchImpl: failFetch(), timeoutMs: 50 });
  assert.equal(result.source, "cache");
  assert.deepEqual(result.branches, [{ slug: "kanyama", name: "Kanyama" }]);
});

test("a first start with no internet gets the built-in list, not an error", async () => {
  const result = await loadBranches({ prefs: memoryPrefs(), fetchImpl: failFetch(), timeoutMs: 50 });
  assert.equal(result.source, "fallback");
  assert.equal(result.branches.length, FALLBACK_BRANCHES.length);
});

test("a hanging request is cut off by the timeout and falls back", async () => {
  const hanging = () => new Promise(() => {});
  const result = await loadBranches({ prefs: memoryPrefs(), fetchImpl: hanging, timeoutMs: 30 });
  assert.equal(result.source, "fallback");
});

test("a malformed answer is treated as a failure, not a crash", async () => {
  const bad = () => Promise.resolve({ ok: true, json: () => Promise.reject(new Error("bad json")) });
  const result = await loadBranches({ prefs: memoryPrefs(), fetchImpl: bad, timeoutMs: 50 });
  assert.equal(result.source, "fallback");
});

test("a non-200 answer is a failure too", async () => {
  const notFound = () => Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({}) });
  const result = await loadBranches({ prefs: memoryPrefs(), fetchImpl: notFound, timeoutMs: 50 });
  assert.equal(result.source, "fallback");
});
