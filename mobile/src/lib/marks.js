import { readJSON, writeJSON } from "./storage.js";

export const READ_ANNOUNCEMENTS = "upcz.readAnnouncements";

export async function readMarks(prefs, key) {
  const value = await readJSON(prefs, key, []);
  return Array.isArray(value) ? value.map(String) : [];
}

export async function writeMarks(prefs, key, list) {
  await writeJSON(prefs, key, list);
}

export async function markRead(prefs, key, id) {
  const marks = await readMarks(prefs, key);
  const value = String(id);
  if (marks.includes(value)) return marks;
  const next = [...marks, value];
  await writeMarks(prefs, key, next);
  return next;
}

export function unreadOf(items, marks) {
  const read = new Set(marks);
  return items.filter((item) => !read.has(String(item.id)));
}

export function unreadCount(items, marks) {
  return unreadOf(items, marks).length;
}
