import { API_BASE, fetchJSON } from "./api.js";
import { readJSON, writeJSON } from "./storage.js";

export function homeKey(branchSlug) {
  return `upcz.home.${branchSlug}`;
}

export function timeAgo(at, now) {
  const diff = Math.max(0, now - at);
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return minutes === 1 ? "1 minute ago" : `${minutes} minutes ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours === 1 ? "1 hour ago" : `${hours} hours ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  return new Date(at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

export function homeSlots(data) {
  const slots = ["greeting"];
  if (data?.live) slots.push("live");
  if (data?.events?.some((event) => event.date === data.date)) slots.push("today-event");
  if (data?.verse) slots.push("verse");
  if (data?.daily_message) slots.push("message");
  if (data?.sermons?.length) slots.push("sermons");
  if (data?.events?.length) slots.push("events");
  return slots;
}

export async function loadHome({ prefs, branchSlug, fetchImpl, timeoutMs = 8000, now = () => Date.now() }) {
  if (!branchSlug) return { data: null, source: "none", fetchedAt: null };
  const key = homeKey(branchSlug);
  try {
    const data = await fetchJSON(`${API_BASE}/app/home/?branch=${encodeURIComponent(branchSlug)}`, { fetchImpl, timeoutMs });
    if (!data || data.branch?.slug !== branchSlug) throw new Error("wrong branch");
    const fetchedAt = now();
    await writeJSON(prefs, key, { at: fetchedAt, data });
    return { data, source: "api", fetchedAt };
  } catch {
    const cached = await readJSON(prefs, key, null);
    if (cached?.data) return { data: cached.data, source: "cache", fetchedAt: cached.at };
    return { data: null, source: "offline", fetchedAt: null };
  }
}
