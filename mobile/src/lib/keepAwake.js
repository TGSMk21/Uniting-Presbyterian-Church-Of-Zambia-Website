import { useEffect } from "react";

// Keeps the screen on while reading (a hymn, a long message). Uses the Wake Lock
// API where the phone supports it; elsewhere it quietly does nothing.
export function useKeepAwake(active) {
  useEffect(() => {
    if (!active) return undefined;
    let lock = null;
    const request = async () => {
      try {
        lock = await navigator.wakeLock?.request?.("screen");
      } catch {
        lock = null;
      }
    };
    request();
    const onVisible = () => {
      if (document.visibilityState === "visible" && (!lock || lock.released)) request();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      lock?.release?.().catch(() => {});
    };
  }, [active]);
}
