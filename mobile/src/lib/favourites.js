import { readJSON, writeJSON } from "./storage.js";

export const FAV_KEY = "upcz.favs";
export const KINDS = ["messages", "verses", "sermons", "hymns"];

const LABELS = {
  messages: "Daily messages",
  verses: "Daily verses",
  sermons: "Sermons",
  hymns: "Hymns",
};

export function sectionLabel(kind) {
  return LABELS[kind] ?? kind;
}

export function emptyFavs() {
  return Object.fromEntries(KINDS.map((kind) => [kind, []]));
}

export async function readFavs(prefs) {
  const value = await readJSON(prefs, FAV_KEY, null);
  const favs = emptyFavs();
  if (value && typeof value === "object") {
    for (const kind of KINDS) {
      if (Array.isArray(value[kind])) favs[kind] = value[kind].filter((f) => f && f.id != null);
    }
  }
  return favs;
}

export async function writeFavs(prefs, favs) {
  await writeJSON(prefs, FAV_KEY, favs);
}

export function isFaved(favs, kind, id) {
  return (favs[kind] ?? []).some((f) => String(f.id) === String(id));
}

export async function toggleFav(prefs, kind, item) {
  const favs = await readFavs(prefs);
  const list = favs[kind] ?? [];
  const id = String(item.id);
  const on = !list.some((f) => String(f.id) === id);
  favs[kind] = on
    ? [...list, { id: item.id, title: item.title, sub: item.sub ?? "", snapshot: item.snapshot ?? null, stale: false }]
    : list.filter((f) => String(f.id) !== id);
  await writeFavs(prefs, favs);
  return { favs, on };
}

// What a heart saves: a small card plus the full snapshot, so it still opens offline.
export function messageFavItem(m) {
  return { id: m.id, title: m.title, sub: [m.date, m.reference_verse].filter(Boolean).join(" · "), snapshot: m };
}

export function verseFavItem(v) {
  return { id: v.date, title: v.reference_verse || "Daily verse", sub: v.date, snapshot: v };
}

export function sermonFavItem(s) {
  return {
    id: s.video_id, title: s.title,
    sub: [String(s.preached_at ?? "").slice(0, 10), s.reference_verse].filter(Boolean).join(" · "),
    snapshot: s,
  };
}

export function hymnFavItem(h, label) {
  return { id: h.id, title: `${h.number}. ${h.title}`, sub: label ?? h.collection, snapshot: h };
}

// A favourite whose content is gone from the server list is flagged stale but kept —
// its snapshot still opens offline. Pure: the input is not mutated.
export function markStale(favs, kind, liveIds) {
  const live = new Set(liveIds.map(String));
  return {
    ...favs,
    [kind]: (favs[kind] ?? []).map((f) => ({ ...f, stale: !live.has(String(f.id)) })),
  };
}
