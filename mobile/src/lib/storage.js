import { Preferences } from "@capacitor/preferences";
import { isNative } from "./device.js";
import { THEME_KEY } from "./theme.js";

export const KEYS = {
  theme: THEME_KEY,
  profile: "upcz.profile",
  seenOpening: "upcz.opening",
  firstRunDone: "upcz.firstrun",
  branches: "upcz.branches",
  reduceMotion: "upcz.reduceMotion",
  greeting: "upcz.greeting",
};

function localStore() {
  try {
    return globalThis.localStorage;
  } catch {
    return null;
  }
}

export function getPrefs() {
  if (isNative()) {
    return {
      get: (key) => Preferences.get({ key }).then((r) => r.value),
      set: (key, value) => Preferences.set({ key, value }),
      remove: (key) => Preferences.remove({ key }),
    };
  }
  return {
    get: (key) => Promise.resolve(localStore()?.getItem(key) ?? null),
    set: (key, value) => {
      try {
        localStore()?.setItem(key, value);
      } catch {
        // Blocked storage: the value simply won't persist.
      }
      return Promise.resolve();
    },
    remove: (key) => {
      try {
        localStore()?.removeItem(key);
      } catch {
        // Blocked storage: nothing to remove.
      }
      return Promise.resolve();
    },
  };
}

export function memoryPrefs() {
  const store = {};
  return {
    store,
    get: (key) => Promise.resolve(Object.hasOwn(store, key) ? store[key] : null),
    set: (key, value) => {
      store[key] = value;
      return Promise.resolve();
    },
    remove: (key) => {
      delete store[key];
      return Promise.resolve();
    },
  };
}

export async function readJSON(prefs, key, fallback) {
  try {
    const raw = await prefs.get(key);
    if (raw == null) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export async function writeJSON(prefs, key, value) {
  await prefs.set(key, JSON.stringify(value));
}

export async function readFlag(prefs, key) {
  try {
    return (await prefs.get(key)) === "true";
  } catch {
    return false;
  }
}

export async function writeFlag(prefs, key, value) {
  await prefs.set(key, value ? "true" : "false");
}

export async function removeKey(prefs, key) {
  await prefs.remove(key);
}
