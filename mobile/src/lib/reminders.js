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

// Read-only status: never shows the permission prompt. Only notificationPermission() asks.
// "granted" | "denied" | "prompt" | "unavailable" | "web"
export async function notificationStatus() {
  if (!isNative()) return "web";
  try {
    const { display } = await LocalNotifications.checkPermissions();
    return display === "prompt-with-rationale" ? "prompt" : display;
  } catch {
    return "unavailable";
  }
}

export async function scheduleEventReminders(event, { branchSlug } = {}) {
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
        schedule: { at: p.at, allowWhileIdle: true },
        smallIcon: "ic_stat_upcz",
        iconColor: "#1b2a6b",
        extra: { eventId: String(event.id), branchSlug, date: event.date, start_time: event.start_time ?? "" },
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

// Pure: decides what to cancel and what to reschedule, for ONE branch only.
// pending: [{ id, extra }] from getPending(). events: that branch's current list.
// Reminders of other branches, or with no extra, are never touched.
export function reconcileReminders(pending, events, branchSlug) {
  const cancel = [];
  const reschedule = [];
  const seen = new Set();
  const byId = new Map(events.map((e) => [String(e.id), e]));
  for (const n of pending) {
    const extra = n.extra;
    if (!extra || extra.branchSlug !== branchSlug || extra.eventId == null) continue;
    const event = byId.get(String(extra.eventId));
    if (!event) {
      cancel.push(n.id);
    } else if (String(extra.date) !== String(event.date) || String(extra.start_time) !== String(event.start_time ?? "")) {
      if (!seen.has(String(event.id))) {
        seen.add(String(event.id));
        reschedule.push(event);
      }
    }
  }
  return { cancel, reschedule };
}

// Cancels reminders of this branch whose event is gone, and reschedules changed events
// that are still marked added. Runs on the phone only.
export async function syncReminders(events, branchSlug, addedIds) {
  if (!isNative()) return;
  try {
    const pending = await LocalNotifications.getPending();
    const { cancel, reschedule } = reconcileReminders(pending.notifications, events, branchSlug);
    if (cancel.length) {
      await LocalNotifications.cancel({ notifications: cancel.map((id) => ({ id })) });
    }
    const added = new Set((addedIds ?? []).map(String));
    for (const event of reschedule) {
      if (added.has(String(event.id))) {
        await scheduleEventReminders(event, { branchSlug });
      }
    }
  } catch {
    // Pending list unavailable.
  }
}
