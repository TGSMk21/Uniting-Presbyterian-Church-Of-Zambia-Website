"use client";

import { useSyncExternalStore } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { THEME_KEY, THEME_LABELS, nextTheme, readTheme } from "@/Utilities/theme.mjs";

const ICONS = { system: Monitor, light: Sun, dark: Moon };
const CHANGED = "upcz-theme-change";

// The saved choice lives in this browser; every switch on the page (the menu and
// the phone menu) and other open tabs follow it.
function subscribe(onChange) {
  const fromOtherTab = (event) => {
    if (event.key !== THEME_KEY) return;
    apply(savedTheme());
    onChange();
  };
  window.addEventListener(CHANGED, onChange);
  window.addEventListener("storage", fromOtherTab);
  return () => {
    window.removeEventListener(CHANGED, onChange);
    window.removeEventListener("storage", fromOtherTab);
  };
}

function savedTheme() {
  try { return readTheme(window.localStorage.getItem(THEME_KEY)); } catch { return "system"; }
}

function apply(theme) {
  const root = document.documentElement;
  if (theme === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", theme);
}

// One button that goes Device setting → Light → Dark. `withLabel` shows the
// name beside the icon, for the phone menu and the dashboard sidebar.
export default function ThemeToggle({ className = "theme-toggle", withLabel = false, iconSize = 18 }) {
  const theme = useSyncExternalStore(subscribe, savedTheme, () => "system");

  const change = () => {
    const next = nextTheme(theme);
    apply(next);
    try {
      if (next === "system") window.localStorage.removeItem(THEME_KEY);
      else window.localStorage.setItem(THEME_KEY, next);
    } catch { /* storage blocked: the choice lasts for this page only */ }
    window.dispatchEvent(new Event(CHANGED));
  };

  const Icon = ICONS[theme];
  const label = `Theme: ${THEME_LABELS[theme]}. Change theme`;
  return (
    <button type="button" className={className} onClick={change} aria-label={label} title={label}>
      <Icon size={iconSize} strokeWidth={1.75} aria-hidden="true" />
      {withLabel && <span>{THEME_LABELS[theme]}</span>}
    </button>
  );
}
