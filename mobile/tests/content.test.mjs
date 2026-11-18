import { test } from "node:test";
import assert from "node:assert/strict";
import { memoryPrefs } from "../src/lib/storage.js";
import {
  contentKey, filterMessages, loadMessageDetail, loadMessages, loadSermons,
} from "../src/lib/content.js";

const okFetch = (payload) => () => Promise.resolve({ ok: true, json: () => Promise.resolve(payload) });
const failFetch = () => () => Promise.reject(new Error("offline"));

const SERMONS = {
  branch: { slug: "chilanga", name: "Chilanga" },
  sermons: [{ video_id: "v1", title: "S1", reference_verse: "Psalm 23", preached_at: "2026-11-17T10:00:00Z", duration: "PT31M", is_live: false, minister_name: "Rev T" }],
};
const MESSAGES = {
  branch: { slug: "chilanga", name: "Chilanga" },
  messages: [
    { id: 2, title: "The Good Shepherd", reference_verse: "Psalm 23:1", date: "2026-11-18" },
    { id: 1, title: "Grace", reference_verse: "Ephesians 2:8", date: "2026-11-17" },
  ],
};

test("search matches title and reference, case-insensitively, and empty search returns all", () => {
  assert.equal(filterMessages(MESSAGES.messages, "").length, 2);
  assert.deepEqual(filterMessages(MESSAGES.messages, "shepherd").map((m) => m.id), [2]);
  assert.deepEqual(filterMessages(MESSAGES.messages, "EPHESIANS").map((m) => m.id), [1]);
  assert.deepEqual(filterMessages(MESSAGES.messages, "zzz"), []);
});

test("cache keys are per content kind and branch", () => {
  assert.equal(contentKey("sermons", "chilanga"), "upcz.sermons.chilanga");
  assert.notEqual(contentKey("sermons", "chilanga"), contentKey("messages", "chilanga"));
  assert.notEqual(contentKey("sermons", "chilanga"), contentKey("sermons", "kanyama"));
});

test("sermons: api answer is cached under the branch; wrong-branch answer refused", async () => {
  const prefs = memoryPrefs();
  const result = await loadSermons({ prefs, branchSlug: "chilanga", fetchImpl: okFetch(SERMONS), timeoutMs: 50 });
  assert.equal(result.source, "api");
  assert.equal(result.data.sermons.length, 1);
  assert.ok(JSON.parse(prefs.store[contentKey("sermons", "chilanga")]).data);
  const wrong = await loadSermons({
    prefs: memoryPrefs(), branchSlug: "chilanga", timeoutMs: 50,
    fetchImpl: okFetch({ ...SERMONS, branch: { slug: "kanyama", name: "Kanyama" } }),
  });
  assert.equal(wrong.source, "offline");
  assert.equal(wrong.data, null);
});

test("sermons: offline serves the saved list; nothing saved means empty offline", async () => {
  const prefs = memoryPrefs();
  prefs.store[contentKey("sermons", "chilanga")] = JSON.stringify({ at: 42, data: SERMONS });
  const cached = await loadSermons({ prefs, branchSlug: "chilanga", fetchImpl: failFetch(), timeoutMs: 20 });
  assert.equal(cached.source, "cache");
  assert.equal(cached.fetchedAt, 42);
  assert.equal(cached.data.sermons[0].title, "S1");
  const empty = await loadSermons({ prefs: memoryPrefs(), branchSlug: "chilanga", fetchImpl: failFetch(), timeoutMs: 20 });
  assert.deepEqual(empty, { data: null, source: "offline", fetchedAt: null });
});

test("messages: api, cache and offline behave the same; no branch means no request", async () => {
  let called = false;
  const none = await loadMessages({
    prefs: memoryPrefs(), branchSlug: "",
    fetchImpl: () => { called = true; return Promise.reject(new Error("no")); }, timeoutMs: 20,
  });
  assert.equal(called, false);
  assert.equal(none.source, "none");
  const prefs = memoryPrefs();
  const api = await loadMessages({ prefs, branchSlug: "chilanga", fetchImpl: okFetch(MESSAGES), timeoutMs: 50 });
  assert.equal(api.source, "api");
  assert.equal(api.data.messages.length, 2);
  const cached = await loadMessages({ prefs, branchSlug: "chilanga", fetchImpl: failFetch(), timeoutMs: 20 });
  assert.equal(cached.source, "cache");
  assert.equal(cached.data.messages[0].id, 2);
});

test("message detail: found, cached when offline, null when never seen", async () => {
  const full = { id: 2, title: "The Good Shepherd", message: "Full body.", reference_verse: "Psalm 23:1", verse_text: "The Lord is my shepherd", date: "2026-11-18", minister_name: "Rev T" };
  const prefs = memoryPrefs();
  const got = await loadMessageDetail({ prefs, branchSlug: "chilanga", id: 2, fetchImpl: okFetch(full), timeoutMs: 50 });
  assert.equal(got.message, "Full body.");
  const cached = await loadMessageDetail({ prefs, branchSlug: "chilanga", id: 2, fetchImpl: failFetch(), timeoutMs: 20 });
  assert.equal(cached.title, "The Good Shepherd");
  const missing = await loadMessageDetail({ prefs: memoryPrefs(), branchSlug: "chilanga", id: 9, fetchImpl: failFetch(), timeoutMs: 20 });
  assert.equal(missing, null);
});
