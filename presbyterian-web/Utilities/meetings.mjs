// Meetings and the calendar (AGENT_EXECUTION_PLAN.md, Task 8.3): plain helpers for the
// pages. Zambia keeps UTC+2 all year, so a date and time typed in the form are sent with
// "+02:00". The API decides who may plan, see and change a meeting.
import { SYNOD_NAME } from "./workspace.mjs";

const TIME_ZONE = "Africa/Lusaka";
const OFFSET = "+02:00";
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export const RESPONSES = { pending: "No reply yet", attending: "Attending", apologies: "Sending apologies" };

export function zambiaTime(date, time) {
  const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(date ?? ""));
  const clock = /^(\d{2}):(\d{2})$/.exec(String(time ?? ""));
  if (!day || !clock) return null;
  const [y, m, d] = day.slice(1).map(Number);
  const check = new Date(Date.UTC(y, m - 1, d));
  if (check.getUTCMonth() !== m - 1 || check.getUTCDate() !== d) return null;
  if (Number(clock[1]) > 23 || Number(clock[2]) > 59) return null;
  return `${date}T${time}:00${OFFSET}`;
}

function parts(iso, options) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: TIME_ZONE, ...options }).format(new Date(iso));
}

export function dayKey(iso) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" })
    .format(new Date(iso));
}

function clockOf(iso) {
  return parts(iso, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
}

export function meetingWhen(meeting) {
  const day = parts(meeting.starts_at, { weekday: "short", day: "numeric", month: "short" }).replace(",", "");
  const start = clockOf(meeting.starts_at);
  return meeting.ends_at ? `${day}, ${start} to ${clockOf(meeting.ends_at)}` : `${day}, ${start}`;
}

export function formValues(meeting) {
  return {
    date: dayKey(meeting.starts_at),
    start: clockOf(meeting.starts_at),
    end: meeting.ends_at ? clockOf(meeting.ends_at) : "",
  };
}

// The places someone may plan meetings for (from /workspace/me/ "organise").
export function placeOptions(organise) {
  if (!organise) return [];
  return [
    ...(organise.branches || []).map((b) => ({ value: `branch:${b.slug}`, label: b.name, level: "branch" })),
    ...(organise.presbyteries || []).map((p) => ({ value: `presbytery:${p.slug}`, label: `${p.name} Presbytery`,
      level: "presbytery" })),
    ...(organise.synod ? [{ value: "synod", label: SYNOD_NAME, level: "synod" }] : []),
  ];
}

export function parsePlace(value) {
  const text = String(value ?? "");
  if (text === "synod") return { level: "synod" };
  const [level, slug] = text.split(":");
  if (!SLUG.test(slug ?? "")) return null;
  if (level === "branch") return { level, branch: slug };
  if (level === "presbytery") return { level, presbytery: slug };
  return null;
}

function ids(value) {
  let list;
  try {
    list = JSON.parse(String(value ?? "[]"));
  } catch {
    return [];
  }
  if (!Array.isArray(list)) return [];
  return [...new Set(list.filter((id) => Number.isInteger(id) && id > 0))].slice(0, 200);
}

export function meetingFromForm(formData, { editing = false } = {}) {
  const text = (name, max) => String(formData.get(name) ?? "").trim().slice(0, max);
  const title = text("title", 200);
  if (!title) return { error: "Please give the meeting a name." };
  const where = editing ? null : parsePlace(formData.get("place"));
  if (!editing && !where) return { error: "Please choose who the meeting is for." };
  const date = text("date", 10);
  const startsAt = zambiaTime(date, text("start", 5));
  if (!startsAt) return { error: "Please choose the date and starting time." };
  const end = text("end", 5);
  const endsAt = end ? zambiaTime(date, end) : null;
  if (end && (!endsAt || endsAt <= startsAt)) return { error: "The meeting must end after it starts." };
  const onlineLink = text("online_link", 200);
  if (onlineLink && !/^https:\/\/[^\s]+$/i.test(onlineLink)) {
    return { error: "Use the video call's full address, starting with https://" };
  }
  const body = {
    title, starts_at: startsAt, ends_at: endsAt, venue: text("venue", 200), online_link: onlineLink,
    agenda: text("agenda", 4000),
  };
  if (editing) return { body };
  const template = String(formData.get("template") ?? "");
  return {
    body: {
      title, ...where, ...body, attendees: ids(formData.get("attendees")),
      ...(/^[1-9][0-9]{0,9}$/.test(template) && { template: Number(template) }),
    },
  };
}

// Months, as { year, month } with month 1 to 12.
export function parseMonth(value, now = new Date()) {
  const match = /^(\d{4})-(\d{2})$/.exec(String(value ?? ""));
  if (match && Number(match[2]) >= 1 && Number(match[2]) <= 12) return { year: Number(match[1]), month: Number(match[2]) };
  const [year, month] = dayKey(now).split("-").map(Number);
  return { year, month };
}

export function shiftMonth({ year, month }, by) {
  const index = year * 12 + (month - 1) + by;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

const pad = (n) => String(n).padStart(2, "0");
const iso = (date) => `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;

export function monthKey({ year, month }) {
  return `${year}-${pad(month)}`;
}

export function monthRange({ year, month }) {
  return { from: iso(new Date(Date.UTC(year, month - 1, 1))), to: iso(new Date(Date.UTC(year, month, 0))) };
}

export function monthTitle({ year, month }) {
  return new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" })
    .format(new Date(Date.UTC(year, month - 1, 1)));
}

// Whole weeks, Monday first, covering the month.
export function monthGrid({ year, month }) {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const start = new Date(first);
  start.setUTCDate(1 - ((first.getUTCDay() + 6) % 7));
  const last = new Date(Date.UTC(year, month, 0));
  const weeks = [];
  for (const day = new Date(start); day <= last || weeks.at(-1)?.length < 7; day.setUTCDate(day.getUTCDate() + 1)) {
    if (!weeks.length || weeks.at(-1).length === 7) weeks.push([]);
    weeks.at(-1).push({ key: iso(day), day: day.getUTCDate(), inMonth: day.getUTCMonth() === month - 1 });
  }
  return weeks;
}

export function groupByDay(meetings) {
  const groups = [];
  for (const meeting of meetings || []) {
    const key = dayKey(meeting.starts_at);
    if (groups.at(-1)?.key !== key) {
      const label = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" })
        .format(new Date(`${key}T12:00:00Z`)).replace(",", "");
      groups.push({ key, label, meetings: [] });
    }
    groups.at(-1).meetings.push(meeting);
  }
  return groups;
}

export function attendeeCounts(attendees) {
  const counts = { attending: 0, apologies: 0, pending: 0 };
  for (const row of attendees || []) if (row.response in counts) counts[row.response] += 1;
  return counts;
}
