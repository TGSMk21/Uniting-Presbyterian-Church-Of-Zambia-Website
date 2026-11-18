import { API_BASE, fetchJSON } from "./api.js";
import { readJSON, writeJSON } from "./storage.js";

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

export async function loadCached({ prefs, kind, branchSlug, path, fetchImpl, timeoutMs, now = () => Date.now(), validate }) {
  if (!branchSlug) return { data: null, source: "none", fetchedAt: null };
  const key = contentKey(kind, branchSlug);
  try {
    const data = await fetchJSON(`${API_BASE}${path}`, { fetchImpl, timeoutMs });
    if (!validate(data)) throw new Error("unexpected payload");
    const fetchedAt = now();
    await writeJSON(prefs, key, { at: fetchedAt, data });
    return { data, source: "api", fetchedAt };
  } catch {
    const cached = await readJSON(prefs, key, null);
    if (cached?.data) return { data: cached.data, source: "cache", fetchedAt: cached.at };
    return { data: null, source: "offline", fetchedAt: null };
  }
}

export function loadSermons({ branchSlug, ...opts }) {
  return loadCached({
    ...opts,
    kind: "sermons",
    branchSlug,
    path: `/app/sermons/?branch=${encodeURIComponent(branchSlug)}`,
    validate: (d) => d?.branch?.slug === branchSlug && Array.isArray(d.sermons),
  });
}

export function loadMessages({ branchSlug, ...opts }) {
  return loadCached({
    ...opts,
    kind: "messages",
    branchSlug,
    path: `/app/messages/?branch=${encodeURIComponent(branchSlug)}`,
    validate: (d) => d?.branch?.slug === branchSlug && Array.isArray(d.messages),
  });
}

export async function loadMessageDetail({ prefs, branchSlug, id, fetchImpl, timeoutMs = 8000, now = () => Date.now() }) {
  if (!branchSlug || !id) return null;
  const key = `upcz.message.${id}`;
  try {
    const data = await fetchJSON(
      `${API_BASE}/app/messages/${id}/?branch=${encodeURIComponent(branchSlug)}`,
      { fetchImpl, timeoutMs },
    );
    if (!data?.id) throw new Error("unexpected payload");
    await writeJSON(prefs, key, { at: now(), data });
    return data;
  } catch {
    const cached = await readJSON(prefs, key, null);
    return cached?.data ?? null;
  }
}
