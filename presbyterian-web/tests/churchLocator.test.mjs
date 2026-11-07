// Church locator rules (national "Find a Branch" page). Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  branchMapView,
  directionsUrl,
  distanceKm,
  filterBranches,
  hasLocation,
  sortByDistance,
  towns,
} from "../Utilities/churchLocator.js";

const kabwata = {
  slug: "kabwata", name: "Kabwata Presbyterian Church", address: "Lusaka, Zambia",
  latitude: "-15.433300", longitude: "28.307100", location_confirmed: false,
};
const memorial = {
  slug: "david-livingstone-memorial", name: "David Livingstone Memorial Presbyterian Church",
  address: "Livingstone, Zambia", latitude: "-17.853100", longitude: "25.861400",
  location_confirmed: true,
};
const noPin = { slug: "new", name: "New Branch", address: "", latitude: null, longitude: null };
const all = [kabwata, memorial, noPin];

test("search matches name or town, ignoring case and spacing", () => {
  assert.deepEqual(filterBranches(all, "  KABWATA ").map((b) => b.slug), ["kabwata"]);
  assert.deepEqual(filterBranches(all, "livingstone").map((b) => b.slug), ["david-livingstone-memorial"]);
  assert.deepEqual(filterBranches(all, "lusaka").map((b) => b.slug), ["kabwata"]);
});

test("an empty search shows every branch", () => {
  assert.equal(filterBranches(all, "").length, 3);
  assert.equal(filterBranches(all, "   ").length, 3);
});

test("a search with no match returns nothing", () => {
  assert.deepEqual(filterBranches(all, "nowhere"), []);
});

test("town filter keeps only that town", () => {
  assert.deepEqual(filterBranches(all, "", "Livingstone").map((b) => b.slug), ["david-livingstone-memorial"]);
});

test("towns come from addresses, sorted and without blanks or repeats", () => {
  const other = { ...kabwata, slug: "other" };
  assert.deepEqual(towns([memorial, kabwata, other, noPin]), ["Livingstone", "Lusaka"]);
});

test("a branch needs both coordinates to appear on the map", () => {
  assert.equal(hasLocation(kabwata), true);
  assert.equal(hasLocation(noPin), false);
  assert.equal(hasLocation({ latitude: "-15.4", longitude: null }), false);
});

test("distance between Lusaka and Livingstone is about right", () => {
  // Published straight-line distance is about 370 km.
  const km = distanceKm({ lat: -15.4333, lng: 28.3071 }, { lat: -17.8531, lng: 25.8614 });
  assert.ok(km > 355 && km < 385, `got ${km}`);
});

test("nearest branch comes first and branches without a location go last", () => {
  const nearLivingstone = { lat: -17.8, lng: 25.9 };
  const sorted = sortByDistance([noPin, kabwata, memorial], nearLivingstone);
  assert.deepEqual(sorted.map((b) => b.slug), ["david-livingstone-memorial", "kabwata", "new"]);
  assert.ok(sorted[0].distanceKm < 15);
  assert.equal(sorted[2].distanceKm, null);
});

test("directions use exact coordinates only once a location is confirmed", () => {
  assert.equal(
    directionsUrl(memorial),
    "https://www.google.com/maps/dir/?api=1&destination=-17.853100,25.861400",
  );
  assert.equal(
    directionsUrl(kabwata),
    "https://www.google.com/maps/search/?api=1&query=Kabwata%20Presbyterian%20Church%2C%20Lusaka%2C%20Zambia",
  );
});

test("a branch's own map zooms in on a confirmed pin", () => {
  const view = branchMapView({ latitude: "-15.552348", longitude: "28.269743", location_confirmed: true });
  assert.deepEqual(view, { centre: [-15.552348, 28.269743], zoom: 16, exact: true });
});

test("an unconfirmed position is shown as an area, not a pin", () => {
  const view = branchMapView({ latitude: "-15.55", longitude: "28.27", location_confirmed: false });
  assert.deepEqual(view, { centre: [-15.55, 28.27], zoom: 14, exact: false });
});

test("no position means no map", () => {
  assert.equal(branchMapView({ latitude: null, longitude: null, location_confirmed: false }), null);
  assert.equal(branchMapView(null), null);
  assert.equal(branchMapView({ latitude: "-15.5", longitude: null }), null);
});
