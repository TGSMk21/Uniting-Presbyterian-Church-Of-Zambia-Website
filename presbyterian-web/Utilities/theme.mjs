// Light and dark themes (owner's request, 2026-11-08). The device's own setting
// is the default; a visitor's choice is kept in this browser only.

export const THEMES = ["system", "light", "dark"];
export const THEME_KEY = "upcz-theme";
export const THEME_LABELS = { system: "Device setting", light: "Light", dark: "Dark" };

export function readTheme(value) {
  return THEMES.includes(value) ? value : "system";
}

export function nextTheme(current) {
  return THEMES[(THEMES.indexOf(readTheme(current)) + 1) % THEMES.length];
}

// Runs in <head> before the page is drawn, so a chosen theme never flashes the
// other one first. With no choice the stylesheets follow prefers-color-scheme.
export const themeScript = `try{var t=localStorage.getItem(${JSON.stringify(THEME_KEY)});if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}`;
