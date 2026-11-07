// Branch details and map position in the dashboard (AGENT_EXECUTION_PLAN.md, Task 5.3). Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  detailsFailure,
  detailsFromForm,
  detailsTags,
  formatPosition,
  inZambia,
  parsePosition,
  roundPosition,
} from "../Utilities/branchDetails.mjs";

function form(entries) {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.append(key, value);
  return data;
}

test("positions copied from Google Maps are understood", () => {
  for (const text of ["-15.4167, 28.2833", "-15.4167,28.2833", " -15.4167 28.2833 ", "-15.4167; 28.2833"]) {
    assert.deepEqual(parsePosition(text), { position: { latitude: -15.4167, longitude: 28.2833 } }, text);
  }
});

test("an empty box means no position", () => {
  assert.deepEqual(parsePosition(""), { position: null });
  assert.deepEqual(parsePosition("   "), { position: null });
  assert.deepEqual(parsePosition(undefined), { position: null });
});

test("map clicks are rounded to six places", () => {
  assert.equal(roundPosition(-15.41670049), -15.4167);
  assert.equal(roundPosition(28.28330051), 28.283301);
  assert.deepEqual(parsePosition("-15.41670049, 28.28330051").position, { latitude: -15.4167, longitude: 28.283301 });
});

test("other text is refused with a plain explanation", () => {
  for (const text of ["Lusaka", "-15.4", "-15.4, 28.2, 3", "-15.4, abc", "1e1, 28", "Infinity, 28", "-15.4°S, 28.2°E"]) {
    assert.match(parsePosition(text).error, /two numbers/, text);
  }
});

test("positions outside Zambia are refused, and swapped numbers are spotted", () => {
  assert.match(parsePosition("51.5, -0.12").error, /outside Zambia/);
  assert.match(parsePosition("28.2833, -15.4167").error, /wrong way round/);
});

test("the edges of Zambia are allowed, matching the API", () => {
  for (const [latitude, longitude] of [[-8.2, 31], [-18.1, 26], [-13, 21.9], [-11, 33.7], [-18.5, 21.5], [-8, 34]]) {
    assert.ok(inZambia({ latitude, longitude }), `${latitude}, ${longitude}`);
  }
  for (const [latitude, longitude] of [[-18.6, 26], [-7.9, 31], [-13, 21.4], [-11, 34.1]]) {
    assert.equal(inZambia({ latitude, longitude }), false, `${latitude}, ${longitude}`);
  }
});

test("saved positions fill the box", () => {
  assert.equal(formatPosition("-15.416700", "28.283300"), "-15.4167, 28.2833");
  assert.equal(formatPosition(null, null), "");
  assert.equal(formatPosition("-15.4", null), "");
});

test("the form is sent as the API expects", () => {
  const { values, errors } = detailsFromForm(form({
    contact_email: " office@alpha.org ", contact_phone: "0977 000 000", address: "Plot 1,\r\nLusaka",
    position: "-15.4167, 28.2833", location_confirmed: "on",
  }));
  assert.deepEqual(errors, {});
  assert.deepEqual(values, {
    contact_email: "office@alpha.org", contact_phone: "0977 000 000", address: "Plot 1,\nLusaka",
    location_confirmed: true, latitude: -15.4167, longitude: 28.2833,
  });
});

test("an empty position box clears the position", () => {
  const { values } = detailsFromForm(form({ position: "" }));
  assert.equal(values.latitude, null);
  assert.equal(values.longitude, null);
  assert.equal(values.location_confirmed, false);
});

test("a bad position is caught before sending", () => {
  const { errors } = detailsFromForm(form({ position: "Lusaka" }));
  assert.match(errors.position, /two numbers/);
});

test("API complaints about the position go to the position box", () => {
  assert.deepEqual(detailsFailure(400, { latitude: ["This position is outside Zambia."], contact_phone: ["Bad."] }), {
    error: null, fields: { position: "This position is outside Zambia.", contact_phone: "Bad." },
  });
  assert.deepEqual(detailsFailure(400, { name: ["Odd."] }), { error: "Odd.", fields: {} });
  assert.deepEqual(detailsFailure(401), { signedOut: true });
  assert.match(detailsFailure(403).error, /can't/);
  assert.match(detailsFailure(500).error, /Nothing was saved/);
});

test("saving refreshes the branch's pages and Find a Branch", () => {
  assert.deepEqual(detailsTags("chilanga"), ["branch:chilanga", "branches"]);
});
