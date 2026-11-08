// Uploading page images from the dashboard (AGENT_EXECUTION_PLAN.md, Task 5.2). Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { IMAGE_TYPES, MAX_UPLOAD_BYTES, fitWithin, imageFailure, imageSpec } from "../Utilities/imageUpload.mjs";
import { fieldsFromForm, pageFields } from "../Utilities/pageContent.mjs";
import { contentSecurityPolicy } from "../Utilities/securityHeaders.mjs";
import { serverHeaders } from "../Utilities/staffSession.mjs";

const source = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("large photos shrink to fit, keeping their shape", () => {
  assert.deepEqual(fitWithin(4000, 3000, 2000), { width: 2000, height: 1500 });
  assert.deepEqual(fitWithin(3000, 4000, 2000), { width: 1500, height: 2000 });
  assert.deepEqual(fitWithin(5000, 5000, 600), { width: 600, height: 600 });
});

test("photos that already fit keep their size", () => {
  assert.deepEqual(fitWithin(2000, 1500, 2000), { width: 2000, height: 1500 });
  assert.deepEqual(fitWithin(40, 30, 2000), { width: 40, height: 30 });
});

test("very long, thin images never shrink to nothing", () => {
  assert.deepEqual(fitWithin(10000, 1, 600), { width: 600, height: 1 });
});

test("only the formats the API accepts can be chosen", () => {
  assert.equal(IMAGE_TYPES, "image/jpeg,image/png,image/webp");
});

test("an upload fits within what the website's host and server actions allow", () => {
  const limit = source("next.config.mjs").match(/bodySizeLimit:\s*"([\d.]+)mb"/);
  assert.ok(limit, "next.config.mjs must raise the 1 MB server action limit");
  const megabytes = Number(limit[1]);
  // Next counts a megabyte as 1024 × 1024 bytes.
  assert.ok(megabytes * 1024 * 1024 > MAX_UPLOAD_BYTES, "must leave room for the upload");
  assert.ok(megabytes * 1024 * 1024 < 4_500_000, "Vercel refuses requests over 4.5 MB");
});

test("the API's reason for refusing a photo is shown as it is", () => {
  const reason = "This file can't be used. Please choose a JPG, PNG or WebP photo.";
  assert.deepEqual(imageFailure(400, { image: [reason] }), { error: reason });
});

test("an expired session asks to sign in again", () => {
  assert.deepEqual(imageFailure(401, null), { signedOut: true });
});

test("other failures don't leave the person guessing", () => {
  assert.match(imageFailure(403, null).error, /can't edit/);
  for (const status of [0, 400, 413, 429, 500]) {
    assert.match(imageFailure(status, null).error, /couldn't be saved/, `status ${status}`);
  }
});

test("only image fields on real pages can be uploaded to", () => {
  assert.equal(imageSpec("national", "youth_image", "home"), undefined);
  assert.equal(imageSpec("national", "home", "youth_image").default, "/youthMin.png");
  assert.equal(imageSpec("branch", "home", "logo").transparent, true);
  assert.equal(imageSpec("branch", "home", "tagline"), undefined);
  assert.equal(imageSpec("branch", "nothing", "logo"), undefined);
  assert.equal(imageSpec("branch", "home", "constructor"), undefined);
});

test("saving wording doesn't send image fields", () => {
  const form = new FormData();
  form.set("hero_text", "Hello");
  form.set("youth_image", "media_library/private.pdf");
  const fields = fieldsFromForm("national", "home", form);
  assert.equal(fields.hero_text, "Hello");
  assert.equal("youth_image" in fields, false);
  assert.equal("men_image" in fields, false);
});

test("the fellowships show their original photos until one is uploaded", () => {
  assert.equal(pageFields("national", "home").youth_image, "/youthMin.png");
  const url = "https://pub.example.r2.dev/page_images/abc.webp";
  const fields = pageFields("national", "home", { youth_image: url });
  assert.equal(fields.youth_image, url);
  assert.equal(fields.men_image, "/mm.png");
});

test("a branch shows the church's logo until it uploads its own", () => {
  assert.equal(pageFields("branch", "home", { logo: null }).logo, "/logo.png");
  const url = "https://pub.example.r2.dev/page_images/logo.webp";
  assert.equal(pageFields("branch", "home", { logo: url }).logo, url);
});

test("the home page shows the fellowship photos from its fields", () => {
  const page = source("app/(national)/page.js");
  assert.match(page, /_image`\]/);
  assert.doesNotMatch(page, /youthMin\.png/);
});

test("branch pages show the branch's logo in the header", () => {
  // The navy footer shows the UPCZ crest without its white glow instead (tests/footer.test.mjs).
  assert.match(source("app/[branch]/layout.js"), /logo: data\.logo/);
  // An uploaded logo replaces the crest; the standard one shows as the crest and motto (tests/crestLogo.test.mjs).
  assert.match(source("components/UniversalComponents/nav-client.js"), /<CrestLogo src=\{brand\.logo\}/);
});

test("a file upload lets fetch describe its own body", () => {
  const json = serverHeaders({ secret: "s" });
  assert.equal(json["Content-Type"], "application/json");
  const upload = serverHeaders({ secret: "s", json: false, access: "a" });
  assert.equal("Content-Type" in upload, false);
  assert.equal(upload["X-Internal-Secret"], "s");
  assert.equal(upload.Authorization, "Bearer a");
});

test("uploaded images show when developing locally, without loosening production", () => {
  assert.match(contentSecurityPolicy({ dev: true }), /img-src [^;]*http:\/\/localhost:\*/);
  assert.doesNotMatch(contentSecurityPolicy({ dev: false }), /localhost/);
});
