// The theme the person chose, applied to the page and to Android's system bars.
import { useCallback, useEffect, useState } from "react";
import { SystemBars, SystemBarsStyle } from "@capacitor/core";
import { THEME_COLORS, THEME_KEY, readPref, resolveTheme } from "./theme.js";
import { isNative } from "./device.js";

const query = () => globalThis.matchMedia?.("(prefers-color-scheme: dark)");

function apply(theme) {
  const root = document.documentElement;
  root.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLORS[theme]);
  if (isNative()) {
    // Dark icons on light paper, light icons at night.
    SystemBars.setStyle({ style: theme === "dark" ? SystemBarsStyle.Dark : SystemBarsStyle.Light }).catch(() => {});
  }
}

export function useTheme() {
  const [pref, setPrefState] = useState(() => readPref(localStorage));
  const [systemDark, setSystemDark] = useState(() => query()?.matches ?? false);
  const theme = resolveTheme(pref, systemDark);

  useEffect(() => {
    const media = query();
    if (!media) return undefined;
    const change = (event) => setSystemDark(event.matches);
    media.addEventListener("change", change);
    return () => media.removeEventListener("change", change);
  }, []);

  useEffect(() => apply(theme), [theme]);

  const setPref = useCallback((value) => {
    try {
      localStorage.setItem(THEME_KEY, value);
    } catch {
      // Private storage can be blocked; the choice still holds for this visit.
    }
    setPrefState(value);
  }, []);

  return { pref, theme, setPref };
}
