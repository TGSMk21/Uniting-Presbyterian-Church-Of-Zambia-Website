import { loadCached } from "./content.js";

export function loadEvents({ branchSlug, ...opts }) {
  return loadCached({
    ...opts,
    kind: "events",
    branchSlug,
    path: `/app/events/?branch=${encodeURIComponent(branchSlug)}`,
    validate: (d) => d?.branch?.slug === branchSlug && Array.isArray(d.events),
  });
}

export function localIso(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function todayIso(now = new Date()) {
  return localIso(now);
}

export function sortRecentFirst(events) {
  return [...events].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return String(b.start_time ?? "").localeCompare(String(a.start_time ?? ""));
  });
}

export function isToday(event, today) {
  return event.date === today;
}

export function eventLabel(event, today) {
  if (event.date === today) return "Today";
  const day = new Date(`${event.date}T12:00:00`);
  const todayDate = new Date(`${today}T12:00:00`);
  const diffDays = Math.round((day - todayDate) / 86_400_000);
  if (diffDays === 1) return "Tomorrow";
  if (diffDays < 0) return "Past";
  return day.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
}

export function upcoming(events, today) {
  return events.filter((e) => e.date >= today);
}

export function pastEvents(events, today) {
  return events.filter((e) => e.date < today);
}

export function eventsOnDate(events, isoDate) {
  return events.filter((e) => e.date === isoDate);
}

export function monthGrid(year, month) {
  const first = new Date(year, month, 1);
  const startOffset = (first.getDay() + 6) % 7;
  const start = new Date(year, month, 1 - startOffset);
  const weeks = [];
  for (let w = 0; w < 6; w += 1) {
    const week = [];
    for (let d = 0; d < 7; d += 1) {
      const day = new Date(start.getFullYear(), start.getMonth(), start.getDate() + w * 7 + d);
      week.push({ iso: localIso(day), inMonth: day.getMonth() === month, day: day.getDate() });
    }
    weeks.push(week);
  }
  return weeks;
}

export function dotsFor({ events = [], sermons = [], added = [] }) {
  const dots = {};
  for (const event of events) {
    const existing = dots[event.date] ?? {};
    dots[event.date] = {
      ...existing,
      event: true,
      added: existing.added === true || added.includes(String(event.id)),
    };
  }
  for (const sermon of sermons) {
    const iso = String(sermon.preached_at ?? "").slice(0, 10);
    if (iso) dots[iso] = { ...(dots[iso] ?? {}), sermon: true };
  }
  return dots;
}

export function formatTime(value) {
  return String(value ?? "").slice(0, 5);
}
