import { useCallback, useEffect, useRef, useState } from "react";
import { KEYS, getPrefs, readJSON, writeJSON } from "./storage.js";
import { loadHome } from "./home.js";
import { pickGreeting } from "./greeting.js";
import { useForegroundRefresh } from "./useContent.js";

export function useHome(branchSlug) {
  const [prefs] = useState(() => getPrefs());
  const branchRef = useRef(branchSlug);
  const [state, setState] = useState({ status: "loading", data: null, source: "none", fetchedAt: null });
  const [greeting, setGreeting] = useState(null);
  const [loadedBranch, setLoadedBranch] = useState(branchSlug);
  if (loadedBranch !== branchSlug) {
    setLoadedBranch(branchSlug);
    setState({ status: "loading", data: null, source: "none", fetchedAt: null });
    setGreeting(null);
  }

  useEffect(() => {
    branchRef.current = branchSlug;
  }, [branchSlug]);

  const refresh = useCallback(async () => {
    const result = await loadHome({ prefs, branchSlug: branchRef.current });
    setState({ status: "ready", ...result });
    return result;
  }, [prefs]);

  useEffect(() => {
    let alive = true;
    loadHome({ prefs, branchSlug }).then((result) => {
      if (alive) setState({ status: "ready", ...result });
    });
    return () => {
      alive = false;
    };
  }, [branchSlug, prefs]);

  useForegroundRefresh(useCallback(() => {
    setState((current) => (current.data ? { ...current, status: "refreshing" } : current));
    refresh();
  }, [refresh]));

  const chooseGreeting = useCallback(
    (part) => {
      readJSON(prefs, KEYS.greeting, null).then((last) => {
        const pick = pickGreeting(part, last?.part === part ? last.index : null);
        writeJSON(prefs, KEYS.greeting, { part, index: pick.index }).catch(() => {});
        setGreeting(pick);
      });
    },
    [prefs],
  );

  const pullRefresh = useCallback(async () => {
    setState((current) => (current.data ? { ...current, status: "refreshing" } : current));
    await refresh();
  }, [refresh]);

  return { ...state, greeting, chooseGreeting, refresh, pullRefresh };
}
