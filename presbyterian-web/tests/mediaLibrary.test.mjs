// The media library in the dashboard (AGENT_EXECUTION_PLAN.md, Task 5.3). Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  LIBRARY_PHOTO,
  MAX_FILE_BYTES,
  MEDIA_LIMITS,
  MEDIA_TYPES,
  checkBeforeUpload,
  isPhoto,
  mediaEdits,
  mediaFailure,
  mediaQuery,
  mediaSummary,
  photoSpec,
  tagsText,
} from "../Utilities/mediaLibrary.mjs";

const file = (type, size, name = "x") => ({ type, size, name });

test("limits match the API's", () => {
  assert.equal(MAX_FILE_BYTES, 4_000_000);
  assert.equal(LIBRARY_PHOTO.max_side, 2560);
  assert.deepEqual(MEDIA_LIMITS, { title: 200, description: 2000 });
  assert.deepEqual(MEDIA_TYPES.map((t) => t.value), ["", "image", "document", "audio"]);
});

test("photos are made smaller in the browser; other files go as they are", () => {
  assert.equal(isPhoto(file("image/jpeg", 10)), true);
  assert.equal(isPhoto(file("image/png", 10)), true);
  assert.equal(isPhoto(file("image/webp", 10)), true);
  assert.equal(isPhoto(file("image/gif", 10)), false);
  assert.equal(isPhoto(file("application/pdf", 10)), false);
  // A PNG may be see-through; keep that until the API saves it.
  assert.equal(photoSpec(file("image/png", 10)).transparent, true);
  assert.equal(photoSpec(file("image/jpeg", 10)).transparent, false);
  assert.equal(photoSpec(file("image/jpeg", 10)).max_side, 2560);
});

test("files that can't be sent are stopped before uploading", () => {
  assert.equal(checkBeforeUpload(file("application/pdf", MAX_FILE_BYTES)), null);
  assert.match(checkBeforeUpload(file("application/pdf", MAX_FILE_BYTES + 1)), /up to 4 MB/);
  // Photos are made smaller first, so a large one is fine.
  assert.equal(checkBeforeUpload(file("image/jpeg", 12_000_000)), null);
  assert.match(checkBeforeUpload(file("video/mp4", 100)), /YouTube/);
  assert.match(checkBeforeUpload(file("application/pdf", 0)), /empty/);
  assert.match(checkBeforeUpload(undefined), /Please choose a file/);
});

test("only safe filters reach the API", () => {
  assert.equal(mediaQuery({}), "?page=1");
  assert.equal(mediaQuery({ page: "3", type: "image", tag: " Easter ", q: "choir & youth" }),
    "?page=3&type=image&tag=Easter&q=choir+%26+youth");
  assert.equal(mediaQuery({ page: "0", type: "video", tag: "", q: "   " }), "?page=1");
  assert.equal(mediaQuery({ page: "../x", type: ["image", "audio"] }), "?page=1");
  assert.equal(mediaQuery({ q: "x".repeat(150) }), `?page=1&q=${"x".repeat(100)}`);
});

test("edits are sent as the API expects", () => {
  const data = new FormData();
  data.append("title", "  Easter morning ");
  data.append("description", "Line one\r\nLine two");
  data.append("tags", " Easter , Youth ");
  assert.deepEqual(mediaEdits(data), { title: "Easter morning", description: "Line one\nLine two", tags: "Easter , Youth" });
});

test("API complaints are shown by the right box", () => {
  assert.deepEqual(mediaFailure(401, null), { signedOut: true });
  assert.equal(mediaFailure(403, null).error, "You can't change this branch's files.");
  assert.equal(mediaFailure(404, null).error, "This file no longer exists.");
  assert.match(mediaFailure(413, null).error, /up to 4 MB/);
  const failure = mediaFailure(400, { file: ["This kind of file can't be added."], tags: ["Too many."], other: ["Odd."] });
  assert.equal(failure.fields.file, "This kind of file can't be added.");
  assert.equal(failure.fields.tags, "Too many.");
  assert.equal(failure.error, "Odd.");
  assert.match(mediaFailure(0, null).error, /try again/);
});

test("rows say what the file is, its tags, and who added it when", () => {
  assert.equal(
    mediaSummary({ kind: "PDF", tags: ["Council", "Finance"], uploaded_at: "2026-11-07T07:30:00Z", uploaded_by_name: "Grace" }),
    "PDF · Council, Finance · Added 7 Nov 2026 by Grace",
  );
  assert.equal(mediaSummary({ kind: "Photo", tags: [], uploaded_at: "2026-11-07T23:30:00Z", uploaded_by_name: "" }),
    "Photo · Added 8 Nov 2026");
  assert.equal(tagsText(["Easter", "Youth"]), "Easter, Youth");
  assert.equal(tagsText(undefined), "");
});

test("links to files don't tell the other site where they came from", () => {
  for (const path of [
    "../app/dashboard/(staff)/content/[branch]/media/page.js",
    "../app/dashboard/(staff)/content/[branch]/media/[id]/page.js",
  ]) {
    const source = readFileSync(new URL(path, import.meta.url), "utf8");
    const links = source.match(/<a [^>]*href=\{row\.url\}[^>]*>/g) || [];
    assert.ok(links.length > 0, `${path} has no file link`);
    for (const link of links) {
      assert.match(link, /rel="noopener noreferrer"/, path);
    }
  }
});
