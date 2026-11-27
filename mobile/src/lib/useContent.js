import { useEffect, useRef } from "react";
import { App as NativeApp } from "@capacitor/app";
import { isNative } from "./device.js";

// The app's one foreground listener lives in Shell and calls appStore.refreshWatched().
// This hook remains for anything that genuinely needs its own foreground refresh.
export function useForegroundRefresh(refresh) {
  const refreshRef = useRef(refresh);
  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);
  useEffect(() => {
    const onActive = () => refreshRef.current();
    if (isNative()) {
      let handle;
      NativeApp.addListener("appStateChange", ({ isActive }) => {
        if (isActive) onActive();
      }).then((h) => {
        handle = h;
      });
      return () => {
        handle?.remove();
      };
    }
    const onVis = () => {
      if (document.visibilityState === "visible") onActive();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);
}
