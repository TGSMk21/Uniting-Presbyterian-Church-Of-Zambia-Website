import { KEYS, readJSON, writeJSON } from "./storage.js";

export const API_BASE = String(import.meta.env?.VITE_API_URL || "https://upcz-backend.onrender.com/api").replace(/\/+$/, "");

export const FALLBACK_BRANCHES = [
  { slug: "chawama", name: "Chawama Presbyterian Church" },
  { slug: "chilanga", name: "Chilanga Presbyterian Church" },
  { slug: "david-livingstone-memorial", name: "David Livingstone Memorial Presbyterian Church" },
  { slug: "kabanana", name: "Kabanana Presbyterian Church" },
  { slug: "kanyama", name: "Kanyama Presbyterian Church" },
  { slug: "kabwata", name: "Kabwata Presbyterian Church" },
  { slug: "kaunda-square", name: "Kaunda Square Presbyterian Church" },
  { slug: "matero", name: "Matero Presbyterian Church" },
  { slug: "misisi", name: "Misisi Presbyterian Church" },
  { slug: "st-columbus-kabwe", name: "St Columbus Presbyterian Church, Kabwe" },
];

const SLUG_RE = /^[a-z0-9-]+$/;

export function parseBranches(payload) {
  const list = Array.isArray(payload) ? payload : payload?.results;
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const item of list) {
    if (!item || typeof item.slug !== "string" || typeof item.name !== "string") continue;
    const name = item.name.trim();
    if (!SLUG_RE.test(item.slug) || !name || seen.has(item.slug)) continue;
    seen.add(item.slug);
    out.push({ slug: item.slug, name });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

export async function fetchJSON(url, { fetchImpl = globalThis.fetch?.bind(globalThis), timeoutMs = 8000 } = {}) {
  const controller = new AbortController();
  const abortTimer = setTimeout(() => controller.abort(), timeoutMs);
  let expire;
  const expired = new Promise((_, reject) => {
    expire = reject;
  });
  const expiredTimer = setTimeout(() => expire(new Error("timeout")), timeoutMs);
  try {
    const res = await Promise.race([
      fetchImpl(url, { signal: controller.signal, headers: { accept: "application/json" } }),
      expired,
    ]);
    if (!res.ok) throw new Error(`http ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(abortTimer);
    clearTimeout(expiredTimer);
  }
}

export async function loadBranches({ prefs, fetchImpl, timeoutMs = 8000, now = () => Date.now() }) {
  try {
    const branches = parseBranches(await fetchJSON(`${API_BASE}/branches/`, { fetchImpl, timeoutMs }));
    if (!branches.length) throw new Error("empty list");
    await writeJSON(prefs, KEYS.branches, { at: now(), list: branches });
    return { branches, source: "api" };
  } catch {
    const cached = await readJSON(prefs, KEYS.branches, null);
    if (cached?.list?.length) return { branches: parseBranches(cached.list), source: "cache" };
    return { branches: FALLBACK_BRANCHES, source: "fallback" };
  }
}
