import { test } from "node:test";
import assert from "node:assert/strict";
import { contentKey, filterMessages } from "../src/lib/content.js";
import { messageResource, messagesResource, sermonsResource } from "../src/lib/resources.js";

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

test("sermonsResource: key, path and validate (wrong branch refused)", () => {
  const r = sermonsResource("chilanga");
  assert.equal(r.key, "sermons.chilanga");
  assert.equal(r.path, "/app/sermons/?branch=chilanga");
  assert.ok(r.maxAgeMs > 0);
  assert.equal(r.validate(SERMONS), true);
  assert.equal(r.validate({ ...SERMONS, branch: { slug: "kanyama", name: "Kanyama" } }), false);
  assert.equal(r.validate({}), false);
  assert.equal(r.validate(null), false);
});

test("messagesResource: key, path and validate (wrong branch refused)", () => {
  const r = messagesResource("chilanga");
  assert.equal(r.key, "messages.chilanga");
  assert.equal(r.path, "/app/messages/?branch=chilanga");
  assert.equal(r.validate(MESSAGES), true);
  assert.equal(r.validate({ ...MESSAGES, branch: { slug: "kanyama", name: "Kanyama" } }), false);
  assert.equal(r.validate({ branch: { slug: "chilanga" } }), false);
});

test("messageResource: key, path and validate (wrong id refused)", () => {
  const r = messageResource("chilanga", 2);
  assert.equal(r.key, "message.chilanga.2");
  assert.equal(r.path, "/app/messages/2/?branch=chilanga");
  assert.equal(r.validate({ id: 2, title: "The Good Shepherd" }), true);
  assert.equal(r.validate({ id: 9 }), false);
  assert.equal(r.validate({}), false);
});
