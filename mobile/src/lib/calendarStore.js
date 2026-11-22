import { CapacitorCalendar, CalendarPermissionScope } from "@capgo/capacitor-calendar";
import { isNative } from "./device.js";
import { readJSON, writeJSON } from "./storage.js";

export const ADDED_KEY = "upcz.addedEvents";

export function toggleId(list, id) {
  const value = String(id);
  return list.includes(value) ? list.filter((x) => x !== value) : [...list, value];
}

export async function readAdded(prefs) {
  const value = await readJSON(prefs, ADDED_KEY, []);
  return Array.isArray(value) ? value.map(String) : [];
}

export async function writeAdded(prefs, list) {
  await writeJSON(prefs, ADDED_KEY, list);
}

export async function toggleAdded(prefs, id) {
  const next = toggleId(await readAdded(prefs), id);
  await writeAdded(prefs, next);
  return next;
}

export const ZAMBIA_OFFSET = "+02:00";
const calKey = (eventId) => `upcz.cal.${eventId}`;

// Start and end in milliseconds, read as Zambian time (UTC+02:00 all year, no daylight saving).
export function eventTimes(event) {
  const start = Date.parse(`${event.date}T${String(event.start_time || "09:00:00").slice(0, 8)}${ZAMBIA_OFFSET}`);
  let end = event.end_time ? Date.parse(`${event.date}T${String(event.end_time).slice(0, 8)}${ZAMBIA_OFFSET}`) : NaN;
  if (!Number.isFinite(end) || end <= start) end = start + 60 * 60 * 1000;
  return { start, end };
}

// Puts the event in the phone's own calendar. Returns "added" | "denied" | "failed" | "unavailable".
export async function addToPhoneCalendar(event, prefs, { plugin = CapacitorCalendar, native = isNative() } = {}) {
  if (!native) return "unavailable";
  try {
    let { result } = await plugin.checkPermission({ scope: CalendarPermissionScope.WRITE_CALENDAR });
    if (result !== "granted") {
      ({ result } = await plugin.requestFullCalendarAccess());
    }
    if (result !== "granted") return "denied";
    const { start, end } = eventTimes(event);
    const { id } = await plugin.createEvent({
      title: event.title,
      startDate: start,
      endDate: end,
      location: event.location || "",
      description: event.details || "",
      isAllDay: false,
    });
    if (id) {
      await writeJSON(prefs, calKey(event.id), String(id));
    }
    return "added";
  } catch {
    return "failed";
  }
}

// Removes the phone-calendar entry this app made, if any. Always forgets the stored id.
export async function removeFromPhoneCalendar(event, prefs, { plugin = CapacitorCalendar, native = isNative() } = {}) {
  if (!native) return;
  const stored = await readJSON(prefs, calKey(event.id), null);
  if (stored != null) {
    try {
      await plugin.deleteEvent({ id: String(stored) });
    } catch {
      // The person may have deleted it from their calendar already.
    }
  }
  await prefs.remove(calKey(event.id));
}
