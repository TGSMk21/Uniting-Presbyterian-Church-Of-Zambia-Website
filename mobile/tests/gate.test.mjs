import { test } from "node:test";
import assert from "node:assert/strict";
import { completeFirstRun, completeOpening, initialMode, MODES } from "../src/lib/gate.js";

test("the app opens on the opening screen, then first-run, then the tabs", () => {
  assert.equal(initialMode({ seenOpening: false, firstRunDone: false }), MODES.opening);
  assert.equal(initialMode({ seenOpening: true, firstRunDone: false }), MODES.firstRun);
  assert.equal(initialMode({ seenOpening: true, firstRunDone: true }), MODES.app);
});

test("finishing the opening moves to first-run, never straight into an empty app", () => {
  const state = completeOpening({ seenOpening: false, firstRunDone: false });
  assert.equal(state.seenOpening, true);
  assert.equal(initialMode(state), MODES.firstRun);
});

test("continuing or skipping first-run both land in the app; skipping saves an empty profile", () => {
  for (const profile of [{ name: "", branchSlug: "", email: "" }, { name: "Mary", branchSlug: "chilanga", email: "" }]) {
    const state = completeFirstRun({ seenOpening: true, firstRunDone: false }, profile);
    assert.equal(initialMode(state), MODES.app);
  }
});

test("deleting my information returns to first-run, not to a wiped app", () => {
  const state = completeFirstRun({ seenOpening: true, firstRunDone: true }, { name: "Mary", branchSlug: "chilanga", email: "" });
  assert.equal(initialMode({ ...state, firstRunDone: false }), MODES.firstRun);
});
