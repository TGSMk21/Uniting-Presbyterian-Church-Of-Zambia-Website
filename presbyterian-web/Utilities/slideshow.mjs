// Shared by the project and activity photo overlay and the home page banners.

export const SLIDE_SECONDS = 6;

export function step(index, by, count) {
  if (count < 1) return 0;
  return (((index + by) % count) + count) % count;
}

// `held`: the pointer is over the slideshow or a control inside has focus.
export function shouldAdvance({ count, playing, held }) {
  return count > 1 && playing && !held;
}

export function prefersReducedMotion() {
  return typeof window !== "undefined" && Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
}
