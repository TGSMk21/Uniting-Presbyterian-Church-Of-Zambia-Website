// What the phone is and what it can do. Everything here fails safe in a browser.
import { Capacitor } from "@capacitor/core";
import { Haptics, ImpactStyle } from "@capacitor/haptics";

export const isNative = () => Capacitor.isNativePlatform();

// Low-end phones get no background blur and no tilt (MOBILE_APP_PLAN.md, Phase 0 proof).
export function isLowEnd(nav = globalThis.navigator) {
  const memory = nav?.deviceMemory ?? 4;
  const cores = nav?.hardwareConcurrency ?? 4;
  return memory <= 2 || (memory <= 3 && cores <= 4);
}

export function prefersReducedMotion() {
  return globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

// A light tap of feedback on meaningful moments only (a tab change, a sheet snapping home).
export function tap() {
  if (isNative()) Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
}
