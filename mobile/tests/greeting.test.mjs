// The time of day for the greeting (spec 4; the full set of greetings comes in Phase 2).
import { test } from "node:test";
import assert from "node:assert/strict";
import { partOfDay } from "../src/lib/greeting.js";

const at = (hour, minute = 0) => new Date(2026, 10, 14, hour, minute);

test("morning, afternoon and evening by the phone's clock", () => {
  assert.equal(partOfDay(at(5)), "morning");
  assert.equal(partOfDay(at(11, 59)), "morning");
  assert.equal(partOfDay(at(12)), "afternoon");
  assert.equal(partOfDay(at(16, 59)), "afternoon");
  assert.equal(partOfDay(at(17)), "evening");
  assert.equal(partOfDay(at(23)), "evening");
  // "Good night" is a goodbye, so the small hours stay "evening".
  assert.equal(partOfDay(at(2)), "evening");
});
