export function contentKey(kind, branchSlug) {
  return `upcz.${kind}.${branchSlug}`;
}

export function filterMessages(messages, q) {
  const needle = String(q ?? "").trim().toLowerCase();
  if (!needle) return messages;
  return messages.filter((m) =>
    m.title.toLowerCase().includes(needle) || (m.reference_verse ?? "").toLowerCase().includes(needle),
  );
}
