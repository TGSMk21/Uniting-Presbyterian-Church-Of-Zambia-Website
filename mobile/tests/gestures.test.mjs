// Gesture maths for sheets (apple-design skill: momentum projection and rubber-banding).
import { test } from "node:test";
import assert from "node:assert/strict";
import { project, rubberband, sheetShouldClose } from "../src/lib/gestures.js";

test("a flick travels further than where the finger let go", () => {
  assert.equal(project(0), 0);
  assert.ok(Math.abs(project(1000) - 499) < 1);
  assert.ok(project(-1000) < 0);
});

test("pulling past an edge resists more the further it goes", () => {
  const a = rubberband(50, 400);
  const b = rubberband(200, 400);
  assert.ok(a > 0 && a < 50);
  assert.ok(b > a && b < 200);
  assert.ok(b - a < 150);
  assert.ok(rubberband(-50, 400) < 0);
});

test("a sheet closes when dragged or flicked far enough down, and stays when flicked back up", () => {
  assert.equal(sheetShouldClose({ offset: 300, velocity: 0, height: 500 }), true);
  assert.equal(sheetShouldClose({ offset: 60, velocity: 900, height: 500 }), true);
  assert.equal(sheetShouldClose({ offset: 300, velocity: -800, height: 500 }), false);
  assert.equal(sheetShouldClose({ offset: 40, velocity: 50, height: 500 }), false);
});
