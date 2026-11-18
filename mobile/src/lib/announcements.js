export function sortAnnouncements(list) {
  return [...list].sort((a, b) => {
    if (Boolean(a.is_pinned) !== Boolean(b.is_pinned)) return a.is_pinned ? -1 : 1;
    if (a.starts_on !== b.starts_on) return a.starts_on < b.starts_on ? 1 : -1;
    return 0;
  });
}
