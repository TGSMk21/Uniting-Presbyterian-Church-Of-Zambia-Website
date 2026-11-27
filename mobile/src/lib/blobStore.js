// Where the app's saved copies live: files on the phone (Capacitor Filesystem),
// localStorage in a browser, memory in tests. Preferences keeps only small settings.
import { Filesystem, Directory, Encoding } from "@capacitor/filesystem";
import { Preferences } from "@capacitor/preferences";
import { isNative } from "./device.js";

const KEY_RE = /^[a-z0-9][a-z0-9.-]*$/;

function checkKey(key) {
  if (typeof key !== "string" || !KEY_RE.test(key)) throw new Error("bad cache key");
  return key;
}

export function memoryBlobs() {
  const store = new Map();
  return {
    store,
    get: async (key) => {
      checkKey(key);
      const raw = store.get(key);
      if (raw == null) return null;
      try {
        return JSON.parse(raw);
      } catch {
        return null;
      }
    },
    set: async (key, value) => {
      checkKey(key);
      store.set(key, JSON.stringify(value));
    },
    clear: async () => {
      store.clear();
    },
  };
}

export function webBlobs() {
  const prefix = "upcz.c.";
  const ls = () => {
    try {
      return globalThis.localStorage;
    } catch {
      return null;
    }
  };
  return {
    get: async (key) => {
      checkKey(key);
      try {
        const raw = ls()?.getItem(prefix + key) ?? null;
        return raw == null ? null : JSON.parse(raw);
      } catch {
        return null;
      }
    },
    set: async (key, value) => {
      checkKey(key);
      try {
        ls()?.setItem(prefix + key, JSON.stringify(value));
      } catch {
        // Blocked storage: the copy simply won't persist.
      }
    },
    clear: async () => {
      try {
        const s = ls();
        if (!s) return;
        const doomed = [];
        for (let i = 0; i < s.length; i += 1) {
          const k = s.key(i);
          if (k && k.startsWith(prefix)) doomed.push(k);
        }
        for (const k of doomed) s.removeItem(k);
      } catch {
        // Blocked storage: nothing to remove.
      }
    },
  };
}

export function nativeBlobs() {
  const file = (key) => `cache/${checkKey(key)}.json`;
  return {
    get: async (key) => {
      try {
        const res = await Filesystem.readFile({ path: file(key), directory: Directory.Data, encoding: Encoding.UTF8 });
        const raw = typeof res.data === "string" ? JSON.parse(res.data) : res.data;
        return raw ?? null;
      } catch {
        return null; // Missing file, or unreadable.
      }
    },
    set: async (key, value) => {
      await Filesystem.writeFile({
        path: file(key),
        directory: Directory.Data,
        data: JSON.stringify(value),
        encoding: Encoding.UTF8,
        recursive: true,
      });
    },
    clear: async () => {
      try {
        await Filesystem.rmdir({ path: "cache", directory: Directory.Data, recursive: true });
      } catch {
        // The folder doesn't exist yet.
      }
    },
  };
}

export function defaultBlobs() {
  return isNative() ? nativeBlobs() : webBlobs();
}

// One-time clean-up of the old caches the previous code kept in Preferences/localStorage.
const LEGACY_PREFIXES = [
  "upcz.home.", "upcz.sermons.", "upcz.messages.", "upcz.message.",
  "upcz.events.", "upcz.announcements.", "upcz.hymns.",
];
const LEGACY_EXACT = ["upcz.hymnCollections"];

export async function removeLegacyCaches() {
  const isLegacy = (key) => LEGACY_PREFIXES.some((p) => key.startsWith(p)) || LEGACY_EXACT.includes(key);
  if (isNative()) {
    const { keys } = await Preferences.keys();
    for (const key of keys) {
      if (isLegacy(key)) await Preferences.remove({ key });
    }
    return;
  }
  const s = globalThis.localStorage;
  if (!s) return;
  const doomed = [];
  for (let i = 0; i < s.length; i += 1) {
    const k = s.key(i);
    if (k && isLegacy(k)) doomed.push(k);
  }
  for (const k of doomed) s.removeItem(k);
}
