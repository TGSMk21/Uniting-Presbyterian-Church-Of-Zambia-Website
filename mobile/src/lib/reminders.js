import { LocalNotifications } from "@capacitor/local-notifications";
import { isNative } from "./device.js";
import { formatTime } from "./events.js";

export function reminderIds(eventId) {
  return [`upcz-ev${eventId}-eve`, `upcz-ev${eventId}-day`];
}

function hashId(str) {
  let hash = 0;
  for (const char of str) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return hash % 2_000_000_000;
}

export function reminderPlan(event, now = new Date()) {
  const start = formatTime(event.start_time) || "09:00";
  const day = new Date(`${event.date}T12:00:00`);
  const evening = new Date(day);
  evening.setDate(evening.getDate() - 1);
  evening.setHours(18, 0, 0, 0);
  const morning = new Date(day);
  morning.setHours(7, 0, 0, 0);
  const location = event.location ? ` · ${event.location}` : "";
  const plans = [
    { id: reminderIds(event.id)[0], at: evening, title: event.title, body: `Tomorrow at ${start}${location}` },
    { id: reminderIds(event.id)[1], at: morning, title: event.title, body: `Today at ${start}${location}` },
  ];
  return plans.filter((plan) => plan.at > now);
}

export async function notificationPermission() {
  if (!isNative()) return "web";
  try {
    const current = await LocalNotifications.checkPermissions();
    if (current.display === "granted") return "granted";
    const asked = await LocalNotifications.requestPermissions();
    return asked.display;
  } catch {
    return "unavailable";
  }
}

export async function scheduleEventReminders(event) {
  if (!isNative()) return false;
  if ((await notificationPermission()) !== "granted") return false;
  await cancelEventReminders(event.id);
  const plan = reminderPlan(event);
  if (!plan.length) return true;
  try {
    await LocalNotifications.schedule({
      notifications: plan.map((p) => ({
        id: hashId(p.id),
        title: p.title,
        body: p.body,
        schedule: { at: p.at },
        extra: { eventId: String(event.id) },
      })),
    });
    return true;
  } catch {
    return false;
  }
}

export async function cancelEventReminders(eventId) {
  if (!isNative()) return;
  try {
    await LocalNotifications.cancel({
      notifications: reminderIds(eventId).map((id) => ({ id: hashId(id) })),
    });
  } catch {
    // Nothing scheduled yet.
  }
}

export async function removeStaleReminders(keptEventIds) {
  if (!isNative()) return;
  try {
    const pending = await LocalNotifications.getPending();
    const keep = new Set(keptEventIds.flatMap(reminderIds).map(hashId));
    const stale = pending.notifications.filter((n) => !keep.has(n.id));
    if (stale.length) {
      await LocalNotifications.cancel({ notifications: stale.map((n) => ({ id: n.id })) });
    }
  } catch {
    // Pending list unavailable.
  }
}
