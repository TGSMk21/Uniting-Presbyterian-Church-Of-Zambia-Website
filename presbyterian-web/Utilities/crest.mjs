// The church's crest and motto (owner's request, 2026-11-08); see
// components/UniversalComponents/crest-logo.js.

export const DEFAULT_LOGO = "/logo.png";
export const MOTTO = "Nec tamen consumebatur";

// A branch's uploaded logo replaces the crest in its top bar.
export function isOwnLogo(src) {
  return Boolean(src) && src !== DEFAULT_LOGO;
}
