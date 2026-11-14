// Light, dark and follow-the-phone (MOBILE_APP_PLAN.md, Phase 0).
// index.html sets the theme before the first paint with the same key and colours.

export const THEME_KEY = "upcz.theme";
export const THEME_PREFS = ["system", "light", "dark"];
export const THEME_COLORS = { light: "#f6f3ec", dark: "#0d1017" };

export function readPref(storage) {
  try {
    const value = storage.getItem(THEME_KEY);
    return THEME_PREFS.includes(value) ? value : "system";
  } catch {
    return "system";
  }
}

export function resolveTheme(pref, systemDark) {
  if (pref === "light" || pref === "dark") return pref;
  return systemDark ? "dark" : "light";
}
