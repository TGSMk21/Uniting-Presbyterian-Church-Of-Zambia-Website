import * as capgoCalendar from "@capgo/capacitor-calendar";
import { isNative } from "./device.js";
import { readJSON, writeJSON } from "./storage.js";

const Calendar = capgoCalendar.Calendar;

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

function eventTimes(event) {
  const start = `${event.date}T${String(event.start_time ?? "09:00:00").slice(0, 8)}`;
  const end = `${event.date}T${String(event.end_time ?? "10:00:00").slice(0, 8)}`;
  return { start: new Date(start), end: new Date(end) };
}

export async function addToPhoneCalendar(event, prefs) {
  if (!isNative()) return false;
  try {
    const current = await Calendar.checkPermissions();
    const granted = current?.calendar === "granted" ? current : await Calendar.requestPermissions();
    if (granted?.calendar !== "granted") return false;
    const { start, end } = eventTimes(event);
    const result = await Calendar.createEvent({
      title: event.title,
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      location: event.location ?? "",
      notes: event.details ?? "",
    });
    const calendarEventId = result?.id ?? result?.eventId;
    if (calendarEventId != null) {
      await writeJSON(prefs, `upcz.cal.${event.id}`, String(calendarEventId));
    }
    return true;
  } catch {
    return false;
  }
}

export async function removeFromPhoneCalendar(event, prefs) {
  if (!isNative()) return;
  try {
    const stored = await readJSON(prefs, `upcz.cal.${event.id}`, null);
    if (stored != null) {
      await Calendar.deleteEvent({ id: String(stored) });
      await prefs.remove(`upcz.cal.${event.id}`);
    }
  } catch {
    // Already gone from the phone's calendar.
  }
}
