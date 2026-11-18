import { test } from "node:test";
import assert from "node:assert/strict";
import { GREETINGS, PARTS, fillName, partOfDay, pickGreeting } from "../src/lib/greeting.js";

const at = (hour, minute = 0) => new Date(2026, 10, 14, hour, minute);

test("five parts of the day by the phone's clock", () => {
  assert.equal(partOfDay(at(5)), "early-morning");
  assert.equal(partOfDay(at(7, 59)), "early-morning");
  assert.equal(partOfDay(at(8)), "morning");
  assert.equal(partOfDay(at(11, 59)), "morning");
  assert.equal(partOfDay(at(12)), "afternoon");
  assert.equal(partOfDay(at(16, 59)), "afternoon");
  assert.equal(partOfDay(at(17)), "evening");
  assert.equal(partOfDay(at(21, 59)), "evening");
  assert.equal(partOfDay(at(22)), "night");
  assert.equal(partOfDay(at(2)), "night");
  assert.equal(partOfDay(at(4, 59)), "night");
  assert.deepEqual(PARTS, ["early-morning", "morning", "afternoon", "evening", "night"]);
});

test("every part of the day has a pool of plain, warm greetings", () => {
  for (const part of PARTS) {
    const pool = GREETINGS[part];
    assert.ok(Array.isArray(pool) && pool.length >= 4, `${part} needs at least 4`);
    for (const line of pool) {
      assert.ok(line.length <= 80, `too long: ${line}`);
      assert.ok(!/\b(awesome|amazing|super|blessed be the|hallelujah)\b/i.test(line), `cliché: ${line}`);
    }
  }
});

test("the pool never repeats the same greeting twice in a row", () => {
  for (const part of PARTS) {
    let last = null;
    for (let i = 0; i < 40; i += 1) {
      const pick = pickGreeting(part, last, () => (i * 7 + 3) % 97 / 97);
      assert.notEqual(pick.index, last);
      last = pick.index;
    }
  }
});

test("an unknown part falls back to a real pool", () => {
  const pick = pickGreeting("mars", null, () => 0.5);
  assert.ok(GREETINGS.morning.includes(pick.text));
});

test("the person's first name fills the greeting, and a missing name reads cleanly", () => {
  assert.equal(fillName("Good morning, {name}.", "Mary"), "Good morning, Mary.");
  assert.equal(fillName("Good morning, {name}.", ""), "Good morning.");
  assert.equal(fillName("Rise gently, {name}. Grace meets you here.", "Mary"), "Rise gently, Mary. Grace meets you here.");
  assert.equal(fillName("Rise gently, {name}. Grace meets you here.", ""), "Rise gently. Grace meets you here.");
});
