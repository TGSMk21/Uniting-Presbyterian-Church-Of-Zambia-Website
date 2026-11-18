import { useCallback, useEffect, useRef, useState } from "react";
import { App as NativeApp } from "@capacitor/app";
import { getPrefs } from "./storage.js";
import { isNative } from "./device.js";

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

export function useContentData(load, branchSlug) {
  const [prefs] = useState(() => getPrefs());
  const [state, setState] = useState({ status: "loading", data: null, source: "none", fetchedAt: null });
  const [loadedBranch, setLoadedBranch] = useState(branchSlug);
  if (loadedBranch !== branchSlug) {
    setLoadedBranch(branchSlug);
    setState({ status: "loading", data: null, source: "none", fetchedAt: null });
  }

  const refresh = useCallback(async () => {
    const result = await load({ prefs, branchSlug });
    setState({ status: "ready", ...result });
    return result;
  }, [load, prefs, branchSlug]);

  useEffect(() => {
    let alive = true;
    load({ prefs, branchSlug }).then((result) => {
      if (alive) setState({ status: "ready", ...result });
    });
    return () => {
      alive = false;
    };
  }, [load, prefs, branchSlug]);

  useForegroundRefresh(refresh);

  return { ...state, refresh };
}
