import { test } from "node:test";
import assert from "node:assert/strict";
import { memoryPrefs } from "../src/lib/storage.js";
import {
  FAV_KEY, KINDS, emptyFavs, hymnFavItem, isFaved, markStale, messageFavItem, readFavs,
  sectionLabel, sermonFavItem, toggleFav, verseFavItem, writeFavs,
} from "../src/lib/favourites.js";

const MESSAGE = { id: 5, title: "Today's word", sub: "18 Nov · John 3:16", snapshot: { id: 5, title: "Today's word", message: "Full text", reference_verse: "John 3:16", date: "2026-11-18" } };
const SERMON = { id: "vid1", title: "Sunday sermon", sub: "16 Nov · Psalm 23", snapshot: { video_id: "vid1", title: "Sunday sermon" } };

test("empty favourites have all four kinds", () => {
  assert.deepEqual(Object.keys(emptyFavs()).sort(), [...KINDS].sort());
  assert.equal(sectionLabel("messages"), "Daily messages");
  assert.equal(sectionLabel("verses"), "Daily verses");
  assert.equal(sectionLabel("sermons"), "Sermons");
  assert.equal(sectionLabel("hymns"), "Hymns");
});

test("malformed stored entries are dropped, well-formed ones kept", async () => {
  const prefs = memoryPrefs({
    [FAV_KEY]: JSON.stringify({ sermons: [null, { noId: true }, SERMON, "junk"] }),
  });
  const favs = await readFavs(prefs);
  assert.deepEqual(favs.sermons, [SERMON]);
});

test("a bad stored value reads as empty, and a partial one is completed", async () => {
  assert.deepEqual(await readFavs(memoryPrefs({ [FAV_KEY]: "{oops" })), emptyFavs());
  const partial = memoryPrefs({ [FAV_KEY]: JSON.stringify({ messages: [MESSAGE] }) });
  const favs = await readFavs(partial);
  assert.equal(favs.messages.length, 1);
  assert.deepEqual(favs.sermons, []);
});

test("toggle adds with snapshot and removes; isFaved follows", async () => {
  const prefs = memoryPrefs();
  let favs = await readFavs(prefs);
  assert.equal(isFaved(favs, "messages", 5), false);
  let result = await toggleFav(prefs, "messages", MESSAGE);
  assert.equal(result.on, true);
  assert.equal(isFaved(result.favs, "messages", 5), true);
  assert.equal(result.favs.messages[0].snapshot.message, "Full text");
  favs = await readFavs(prefs);
  assert.equal(isFaved(favs, "messages", 5), true);
  result = await toggleFav(prefs, "messages", MESSAGE);
  assert.equal(result.on, false);
  assert.equal(isFaved(result.favs, "messages", 5), false);
  // kinds are independent, ids compared as strings
  await toggleFav(prefs, "sermons", SERMON);
  favs = await readFavs(prefs);
  assert.equal(isFaved(favs, "sermons", "vid1"), true);
  assert.equal(isFaved(favs, "hymns", "vid1"), false);
});

test("stale marking flags favourites missing from the live list, keeps the rest", async () => {
  const prefs = memoryPrefs();
  await toggleFav(prefs, "sermons", SERMON);
  await toggleFav(prefs, "sermons", { id: "gone", title: "Removed", sub: "", snapshot: { video_id: "gone" } });
  const favs = await readFavs(prefs);
  const marked = markStale(favs, "sermons", ["vid1"]);
  assert.equal(marked.sermons.find((f) => f.id === "vid1").stale, false);
  assert.equal(marked.sermons.find((f) => f.id === "gone").stale, true);
  // other kinds untouched
  assert.deepEqual(marked.messages, favs.messages);
  // original not mutated
  assert.equal(favs.sermons.every((f) => f.stale === false), true);
  await writeFavs(prefs, marked);
  assert.equal((await readFavs(prefs)).sermons.find((f) => f.id === "gone").stale, true);
});

test("favourite item builders keep the snapshot and a readable subtitle", () => {
  assert.deepEqual(messageFavItem({ id: 5, title: "Word", date: "2026-11-18", reference_verse: "John 3:16", message: "m" }),
    { id: 5, title: "Word", sub: "2026-11-18 · John 3:16", snapshot: { id: 5, title: "Word", date: "2026-11-18", reference_verse: "John 3:16", message: "m" } });
  assert.equal(verseFavItem({ date: "2026-11-18", reference_verse: "Psalm 23" }).id, "2026-11-18");
  assert.equal(sermonFavItem({ video_id: "v", title: "S", preached_at: "2026-11-16T10:00:00Z", reference_verse: "Ps 23" }).sub, "2026-11-16 · Ps 23");
  assert.equal(hymnFavItem({ id: 9, number: 12, title: "T", collection: "tumbuka" }, "Tumbuka Hymns").title, "12. T");
});
