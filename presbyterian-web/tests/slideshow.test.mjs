// Slideshows: the project and activity photos and the home page banners
// (owner's requests, 2026-11-08). Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SLIDE_SECONDS, shouldAdvance, step } from "../Utilities/slideshow.mjs";

test("stepping wraps round both ways", () => {
  assert.equal(step(0, 1, 3), 1);
  assert.equal(step(2, 1, 3), 0);
  assert.equal(step(0, -1, 3), 2);
  assert.equal(step(0, 1, 1), 0);
  assert.equal(step(0, 1, 0), 0);
});

test("it moves on by itself only when playing, not held, and with more than one", () => {
  assert.ok(SLIDE_SECONDS >= 5);
  assert.equal(shouldAdvance({ count: 3, playing: true, held: false }), true);
  assert.equal(shouldAdvance({ count: 1, playing: true, held: false }), false);
  assert.equal(shouldAdvance({ count: 3, playing: false, held: false }), false);
  // Held: the pointer is over it or a control inside has focus.
  assert.equal(shouldAdvance({ count: 3, playing: true, held: true }), false);
});

const board = readFileSync(new URL("../components/ProjectsComponents/item-board.js", import.meta.url), "utf8");

test("the overlay shows a slideshow with pause, and every photo as a grid", () => {
  assert.match(board, /shouldAdvance\(/);
  assert.match(board, /aria-label=\{playing \? "Pause slideshow" : "Play slideshow"\}/);
  assert.match(board, /"All photos"/);
  assert.match(board, /className="pa-grid-view"/);
  // Reduced motion: it doesn't start by itself.
  assert.match(board, /useState\(\(\) => !prefersReducedMotion\(\)\)/);
});

test("an item without photos opens as a single details card", () => {
  assert.match(board, /data-plain=\{item\.photos\.length === 0 \|\| undefined\}/);
  assert.match(board, /\{item\.photos\.length > 0 && <Gallery item=\{item\} \/>\}/);
});
