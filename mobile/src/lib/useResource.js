import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { appStore } from "./appStore.js";

// One constant object, so useSyncExternalStore never sees a fresh snapshot on every render.
const LOADING_ENTRY = { data: null, fetchedAt: null, source: "none", status: "loading", error: null };
const EMPTY_ENTRY = { ...LOADING_ENTRY, status: "ready", refresh: () => Promise.resolve() };

// resource may be null (for example no branch chosen yet).
export function useResource(resource, store = appStore) {
  const key = resource?.key ?? null;
  const resourceRef = useRef(resource);
  useEffect(() => {
    resourceRef.current = resource;
  });

  const subscribe = useCallback(
    (fn) => (key ? store.subscribe(key, fn) : () => {}),
    [store, key],
  );
  const getSnapshot = useCallback(
    () => (key ? store.peek(key) ?? LOADING_ENTRY : LOADING_ENTRY),
    [store, key],
  );
  const entry = useSyncExternalStore(subscribe, getSnapshot);

  useEffect(() => {
    if (resourceRef.current) store.load(resourceRef.current);
  }, [store, key]);

  if (!resource) return EMPTY_ENTRY;
  return { ...entry, refresh: () => store.load(resource, { force: true }) };
}
