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
