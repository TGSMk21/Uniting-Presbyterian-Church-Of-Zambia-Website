// The banner carousel at the top of the national and branch home pages
// (owner's request, 2026-11-08). Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { branchSlides, nationalSlides, safeLink } from "../Utilities/heroSlides.mjs";
import { pageFields } from "../Utilities/pageContent.mjs";
import schema from "../Utilities/pageSchema.json" with { type: "json" };

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("with nothing added, each home page has one slide made of its usual heading", () => {
  const national = nationalSlides(pageFields("national", "home", {}));
  assert.equal(national.length, 1);
  assert.equal(national[0].image, "");
  assert.match(national[0].title, /One family/);
  assert.deepEqual(national[0].actions.map((a) => a.href), ["/find-a-branch"]);

  const branch = branchSlides(pageFields("branch", "home", {}, { branchName: "Chilanga" }), { hasServices: true });
  assert.equal(branch.length, 1);
  assert.deepEqual(branch[0].actions.map((a) => a.href), ["#schedule"]);
  // No service times: no button to them.
  const quiet = branchSlides(pageFields("branch", "home", {}), { hasServices: false });
  assert.deepEqual(quiet[0].actions, []);
});

test("the first slide takes the banner photo; extra slides show once they have a photo or heading", () => {
  const f = pageFields("national", "home", {
    hero_image: "https://media.example.org/a.webp",
    slide2_image: "https://media.example.org/b.webp",
    slide3_title: "Harvest *Sunday*", slide3_button: "Read more", slide3_link: "/contact",
    slide4_text: "Only text, no photo or heading",
  });
  const slides = nationalSlides(f);
  assert.equal(slides.length, 3);
  assert.equal(slides[0].image, "https://media.example.org/a.webp");
  assert.equal(slides[1].image, "https://media.example.org/b.webp");
  assert.deepEqual(slides[1].actions, []);
  assert.equal(slides[2].title, "Harvest *Sunday*");
  assert.deepEqual(slides[2].actions, [{ label: "Read more", href: "/contact", primary: true }]);
  assert.deepEqual(slides.map((s) => s.key), ["hero", "slide2", "slide3"]);
});

test("a button without a usable link isn't shown", () => {
  const f = pageFields("branch", "home", { slide2_title: "T", slide2_button: "Go", slide2_link: "javascript:alert(1)" });
  assert.deepEqual(branchSlides(f, {})[1].actions, []);
  assert.equal(safeLink("/find-a-branch"), "/find-a-branch");
  assert.equal(safeLink("https://youtube.com/@upcz"), "https://youtube.com/@upcz");
  for (const bad of ["//evil.example", "http://a.b", "data:x", "", "/a b"]) assert.equal(safeLink(bad), null, bad);
});

test("both home pages edit four slides, each with a photo and a link field", () => {
  for (const kind of ["national", "branch"]) {
    const titles = schema[kind].home.sections.map((s) => s.title);
    assert.deepEqual(titles.filter((t) => t.startsWith("Banner slide")), ["Banner slide 1", "Banner slide 2", "Banner slide 3", "Banner slide 4"]);
    for (const n of [2, 3, 4]) {
      const keys = schema[kind].home.sections.find((s) => s.title === `Banner slide ${n}`).fields.map((f) => f.key);
      assert.deepEqual(keys, ["image", "title", "text", "button", "link"].map((k) => `slide${n}_${k}`));
    }
  }
});

test("both home pages open with the carousel", () => {
  for (const path of ["app/(national)/page.js", "app/[branch]/page.js"]) {
    const page = read(path);
    assert.match(page, /<HeroCarousel /, path);
    assert.doesNotMatch(page, /className="(nat-)?hero"/, path);
  }
  const carousel = read("components/UniversalComponents/hero-carousel.js");
  assert.match(carousel, /shouldAdvance\(/);
  assert.match(carousel, /aria-roledescription="carousel"/);
  assert.match(carousel, /Pause slides|Play slides/);
  // No "Our story" button beside the main one (owner's request, 2026-11-08).
  assert.doesNotMatch(carousel, /hero-slide-quiet/);
  for (const kind of ["national", "branch"]) {
    const keys = schema[kind].home.sections.flatMap((s) => s.fields.map((f) => f.key));
    assert.ok(!keys.includes("story_link") && !keys.includes("story_button"), kind);
  }
  // No small label above the heading (owner's request, 2026-11-08).
  assert.doesNotMatch(carousel, /hero-slide-label/);
  for (const kind of ["national", "branch"]) {
    const keys = schema[kind].home.sections.flatMap((s) => s.fields.map((f) => f.key));
    assert.ok(!keys.some((k) => k === "hero_label" || /^slide\d_label$/.test(k)), kind);
  }
  // Only the first slide's heading is the page's main heading.
  assert.match(carousel, /i === 0 \? "h1" : "h2"/);
});
