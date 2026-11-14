// The crest's shapes for the opening screen.
import { test } from "node:test";
import assert from "node:assert/strict";
import { CREST_SIZE, CROSS, NAVY, RED, WHITE } from "../src/components/crestPaths.js";

test("every colour of the crest has shapes inside the picture's frame", () => {
  assert.deepEqual(CREST_SIZE, { width: 191, height: 264 });
  for (const [name, paths] of Object.entries({ CROSS, NAVY, RED, WHITE })) {
    assert.ok(paths.length > 0, name);
    for (const d of paths) {
      assert.match(d, /^M[\d.\- ]+[CL]/, name);
      const numbers = d.match(/-?\d+(\.\d+)?/g).map(Number);
      assert.ok(numbers.every((n) => n >= -1 && n <= 265), `${name} stays in the frame`);
    }
  }
});
