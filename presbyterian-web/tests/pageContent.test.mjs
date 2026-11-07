// Editable page wording (AGENT_EXECUTION_PLAN.md, Task 5.2). Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  branchTag,
  contentTag,
  editableScopes,
  fieldsFromForm,
  listLines,
  pageFields,
  pageSchema,
  parseRichText,
  phoneHref,
  scopeKind,
  viewPath,
} from "../Utilities/pageContent.mjs";

test("a page nobody has edited shows its original wording", () => {
  const fields = pageFields("national", "home");
  assert.equal(fields.hero_title, "One family.\n*Many houses.*");
  assert.equal(fields.closing_button, "Find your branch");
});

test("edited wording replaces the original, field by field", () => {
  const fields = pageFields("national", "home", { hero_text: "Hello" });
  assert.equal(fields.hero_text, "Hello");
  assert.equal(fields.hero_label, "Uniting Presbyterian Church In Zambia");
});

test("a failed API call (no changes available) still gives a full page", () => {
  assert.equal(pageFields("branch", "about", null).mission_title, "Our Mission");
  assert.equal(pageFields("branch", "about", undefined).find_label, "Find Us");
});

test("empty values fall back to the original", () => {
  assert.equal(pageFields("branch", "home", { tagline: "" }).tagline, "A place of *grace,* belonging & purpose.");
  assert.equal(pageFields("branch", "home", { tagline: null }).tagline, "A place of *grace,* belonging & purpose.");
});

test("fields that aren't on the page are ignored", () => {
  assert.equal("is_admin" in pageFields("branch", "home", { is_admin: "yes" }), false);
});

test("{branch} becomes the branch's name, in originals and edits alike", () => {
  const original = pageFields("branch", "about", {}, { branchName: "Chilanga" });
  assert.match(original.banner_text, /grace, Chilanga is a community/);
  const edited = pageFields("branch", "about", { banner_text: "Welcome to {branch}!" }, { branchName: "Kabwata" });
  assert.equal(edited.banner_text, "Welcome to Kabwata!");
});

test("{branch} reads naturally if the branch's name isn't known", () => {
  assert.match(pageFields("branch", "about").banner_text, /grace, our church is a community/);
});

test("stars become emphasis", () => {
  assert.deepEqual(parseRichText("We'd love to *hear* from you"), [
    { type: "text", value: "We'd love to " },
    { type: "em", value: "hear" },
    { type: "text", value: " from you" },
  ]);
});

test("line breaks are kept", () => {
  assert.deepEqual(parseRichText("One family.\n*Many houses.*"), [
    { type: "text", value: "One family." },
    { type: "br" },
    { type: "em", value: "Many houses." },
  ]);
});

test("a stray star stays as a star, and never swallows text", () => {
  assert.deepEqual(parseRichText("5 * 3"), [{ type: "text", value: "5 * 3" }]);
  assert.deepEqual(parseRichText("**"), [{ type: "text", value: "**" }]);
  assert.deepEqual(parseRichText(""), []);
});

test("emphasis doesn't run across lines", () => {
  assert.deepEqual(parseRichText("*one\ntwo*"), [
    { type: "text", value: "*one" },
    { type: "br" },
    { type: "text", value: "two*" },
  ]);
});

test("markup is only ever plain text to the formatter", () => {
  const tokens = parseRichText("<script>alert(1)</script> *<b>x</b>*");
  assert.deepEqual(tokens, [
    { type: "text", value: "<script>alert(1)</script> " },
    { type: "em", value: "<b>x</b>" },
  ]);
});

test("the original wording renders the same headings as before", () => {
  assert.deepEqual(parseRichText(pageFields("branch", "sermons").banner_title), [
    { type: "text", value: "Teaching that " },
    { type: "em", value: "transforms" },
  ]);
});

test("list fields become one item per line, skipping blanks", () => {
  assert.deepEqual(listLines("One\n\n  Two  \n"), ["One", "Two"]);
  assert.equal(listLines(pageFields("branch", "about").vision_list).length, 5);
});

test("phone links keep only what a phone link can hold", () => {
  assert.equal(phoneHref("+260 (97) 768-1606"), "tel:+260977681606");
  assert.equal(phoneHref("javascript:alert(1)"), "tel:1");
});

test("the form sends every field on the page and nothing else", () => {
  const form = new FormData();
  form.set("banner_label", "Changed");
  form.set("is_admin", "yes");
  const fields = fieldsFromForm("national", "find-a-branch", form);
  assert.deepEqual(Object.keys(fields).sort(), ["banner_label", "banner_text", "banner_title"]);
  assert.equal(fields.banner_label, "Changed");
  assert.equal(fields.banner_text, "");
});

test("scopes", () => {
  assert.equal(scopeKind("national"), "national");
  assert.equal(scopeKind("chilanga"), "branch");
});

test("each page knows where it can be viewed", () => {
  assert.equal(viewPath("national", "home"), "/");
  assert.equal(viewPath("national", "contact"), "/contact");
  assert.equal(viewPath("chilanga", "home"), "/chilanga");
  assert.equal(viewPath("chilanga", "projects"), "/chilanga/projects-and-activities");
});

test("saving clears a tag per scope, and branches have their own", () => {
  assert.notEqual(contentTag("national"), contentTag("chilanga"));
  assert.notEqual(contentTag("chilanga"), branchTag("chilanga"));
});

const BRANCHES = [{ slug: "alpha", name: "Alpha" }, { slug: "beta", name: "Beta" }];
const slugs = (staff) => editableScopes(staff, BRANCHES).map((s) => s.scope);

test("superusers see the national pages and every branch", () => {
  assert.deepEqual(slugs({ is_superuser: true, role: "content_editor", branch: null }), ["national", "alpha", "beta"]);
});

test("national admins see the national pages", () => {
  assert.deepEqual(slugs({ is_superuser: false, role: "super_admin", branch: null }), ["national"]);
});

test("branch staff see only their branch", () => {
  const branch = { slug: "alpha", name: "Alpha" };
  assert.deepEqual(slugs({ is_superuser: false, role: "branch_admin", branch }), ["alpha"]);
  assert.deepEqual(slugs({ is_superuser: false, role: "content_editor", branch }), ["alpha"]);
});

test("finance staff and staff without a branch see nothing", () => {
  assert.deepEqual(slugs({ is_superuser: false, role: "finance_admin", branch: { slug: "alpha", name: "Alpha" } }), []);
  assert.deepEqual(slugs({ is_superuser: false, role: "content_editor", branch: null }), []);
});

test("every field in the schema has what the editor needs", () => {
  for (const kind of ["national", "branch"]) {
    for (const [page, spec] of Object.entries(pageSchema[kind])) {
      assert.ok(spec.label, page);
      for (const section of spec.sections) {
        for (const field of section.fields) {
          const limit = field.type === "image" ? field.max_side : field.max;
          assert.ok(field.label && field.type && limit > 0, `${page}.${field.key}`);
          assert.equal(typeof field.default, "string", `${page}.${field.key}`);
        }
      }
    }
  }
});

// Each page must render its wording from the schema, or edits would silently do nothing.
const PAGES = [
  ["app/(national)/page.js", "national", "home"],
  ["app/(national)/find-a-branch/page.js", "national", "find-a-branch"],
  ["app/(national)/contact/page.js", "national", "contact"],
  ["app/[branch]/page.js", "branch", "home"],
  ["app/[branch]/about/page.js", "branch", "about"],
  ["app/[branch]/sermons/page.js", "branch", "sermons"],
  ["app/[branch]/projects-and-activities/page.js", "branch", "projects"],
];
const LAYOUT_FIELDS = new Set(["footer_text", "email", "phone"]);

for (const [path, kind, page] of PAGES) {
  test(`${path} uses every editable field`, () => {
    const source = readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
    for (const section of pageSchema[kind][page].sections) {
      for (const { key } of section.fields) {
        if (key === "footer_text" || key === "logo") continue; // shown by the layout
        if (LAYOUT_FIELDS.has(key) && !source.includes(`f.${key}`)) assert.fail(`${key} missing`);
        assert.ok(source.includes(`f.${key}`) || source.includes(`f[\`\${id}_`), `${path} ignores ${key}`);
      }
    }
  });
}

test("the footers use their editable text", () => {
  for (const path of ["app/(national)/layout.js", "app/[branch]/layout.js"]) {
    const source = readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
    assert.match(source, /footer_text/, path);
  }
});
