// The banner carousel at the top of the national and branch home pages
// (owner's request, 2026-11-08). Slide 1 is the page's usual heading and buttons,
// with an optional banner photo; slides 2-4 show once they have a photo or a heading.

const EXTRA = [2, 3, 4];
// The same rule the server checks when staff save (content/page_content.py).
const LINK_RE = /^(\/(?!\/)\S*|https:\/\/[^\s/]+\S*)$/;

export function safeLink(value) {
  return typeof value === "string" && LINK_RE.test(value) ? value : null;
}

function extraSlides(f) {
  return EXTRA.flatMap((n) => {
    const image = f[`slide${n}_image`] || "";
    const title = f[`slide${n}_title`] || "";
    if (!image && !title) return [];
    const href = safeLink(f[`slide${n}_link`]);
    const button = f[`slide${n}_button`];
    return [{
      key: `slide${n}`,
      image,
      title,
      text: f[`slide${n}_text`] || "",
      actions: button && href ? [{ label: button, href, primary: true }] : [],
    }];
  });
}

export function nationalSlides(f) {
  return [
    {
      key: "hero",
      image: f.hero_image || "",
      title: f.hero_title,
      text: f.hero_text,
      actions: [
        { label: f.hero_button, href: "/find-a-branch", primary: true },
        { label: f.story_link, href: "#welcome", primary: false },
      ].filter((a) => a.label),
    },
    ...extraSlides(f),
  ];
}

export function branchSlides(f, { slug, hasServices = false }) {
  return [
    {
      key: "hero",
      image: f.hero_image || "",
      title: f.tagline,
      text: f.welcome_text,
      actions: [
        hasServices && { label: f.schedule_button, href: "#schedule", primary: true },
        { label: f.story_button, href: `/${slug}/about`, primary: false },
      ].filter((a) => a && a.label),
    },
    ...extraSlides(f),
  ];
}
