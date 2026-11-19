import { loadCached } from "./content.js";

export function loadHymnCollections(opts) {
  return loadCached({
    ...opts,
    kind: "hymnCollections",
    global: true,
    path: "/app/hymns/collections/",
    validate: (d) => Array.isArray(d?.collections),
  });
}

export function loadHymns({ collection, ...opts }) {
  return loadCached({
    ...opts,
    kind: "hymns",
    branchSlug: collection,
    path: `/app/hymns/?collection=${encodeURIComponent(collection)}`,
    validate: (d) => d?.collection === collection && Array.isArray(d.hymns),
  });
}

export function filterHymns(hymns, q) {
  const needle = String(q ?? "").trim().toLowerCase();
  if (!needle) return hymns;
  return hymns.filter((h) =>
    h.title.toLowerCase().includes(needle) || String(h.number).includes(needle),
  );
}

export function sortHymns(hymns) {
  return [...hymns].sort((a, b) => a.number - b.number || a.title.localeCompare(b.title));
}
