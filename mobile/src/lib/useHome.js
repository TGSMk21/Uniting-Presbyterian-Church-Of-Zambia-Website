import { useCallback, useState } from "react";
import { KEYS, getPrefs, readJSON, writeJSON } from "./storage.js";
import { homeResource } from "./resources.js";
import { pickGreeting } from "./greeting.js";
import { useResource } from "./useResource.js";

export function useHome(branchSlug) {
  const [prefs] = useState(() => getPrefs());
  const [greeting, setGreeting] = useState(null);
  const entry = useResource(branchSlug ? homeResource(branchSlug) : null);

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

  return { ...entry, greeting, chooseGreeting, refresh: entry.refresh, pullRefresh: entry.refresh };
}
