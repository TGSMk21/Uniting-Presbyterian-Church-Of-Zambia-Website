// The smoothness test's measurement (MOBILE_APP_PLAN.md, Phase 0 proof).
import { test } from "node:test";
import assert from "node:assert/strict";
import { summarizeFrames, verdict } from "../src/lib/frames.js";

test("frame times become plain numbers", () => {
  const s = summarizeFrames([16.7, 16.6, 16.8, 33.4, 16.7]);
  assert.equal(s.frames, 5);
  assert.equal(s.smoothShare, 0.8);
  assert.equal(s.worst, 33.4);
  assert.equal(s.fps, 50);
  assert.deepEqual(summarizeFrames([]), { frames: 0, smoothShare: 1, worst: 0, fps: 0 });
});

test("the verdict the owner reads", () => {
  assert.equal(verdict({ frames: 120, smoothShare: 0.97, worst: 30 }), "smooth");
  assert.equal(verdict({ frames: 120, smoothShare: 0.9, worst: 45 }), "mostly smooth");
  assert.equal(verdict({ frames: 120, smoothShare: 0.7, worst: 120 }), "not smooth");
  assert.equal(verdict({ frames: 3, smoothShare: 1, worst: 16 }), "not enough to tell");
});
