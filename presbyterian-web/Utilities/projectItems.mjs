// The public Projects & Activities page (owner's request, 2026-11-08): projects and
// activities as cards that open into an overlay with their photos and details.
import { todayInZambia } from "./branchContent.mjs";

const STATUS = {
  ONGOING: { text: "In progress", tone: "ongoing" },
  COMPLETED: { text: "Finished", tone: "done" },
  PENDING: { text: "Not started", tone: "planned" },
};

const utcDate = (iso) => new Date(`${iso}T12:00:00Z`);
const format = (iso, options) => new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", ...options }).format(utcDate(iso));
const monthYear = (iso) => format(iso, { month: "short", year: "numeric" });

function paragraphs(text) {
  return String(text || "").split(/\n\s*\n/).map((part) => part.trim()).filter(Boolean);
}

function photos(list) {
  return (list || []).map(({ id, url }) => ({ id, url }));
}

function clock(time) {
  if (!time) return "";
  const [hours, minutes] = time.split(":").map(Number);
  const suffix = hours >= 12 ? "PM" : "AM";
  return `${hours % 12 || 12}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

export function projectItem(project) {
  const pics = photos(project.photos);
  const when = project.end_date
    ? `${monthYear(project.start_date)} – ${monthYear(project.end_date)}`
    : `From ${monthYear(project.start_date)}`;
  return {
    key: `project-${project.id}`,
    kind: "Project",
    title: project.title,
    status: STATUS[project.status] || STATUS.PENDING,
    progress: Math.min(100, Math.max(0, Number(project.progress) || 0)),
    when,
    photos: pics,
    cover: pics[0]?.url || null,
    paragraphs: paragraphs(project.description),
  };
}

export function activityItem(activity) {
  const pics = photos(activity.photos);
  return {
    key: `activity-${activity.id}`,
    kind: "Activity",
    title: activity.title,
    date: activity.date,
    day: {
      number: format(activity.date, { day: "numeric" }),
      month: format(activity.date, { month: "short" }),
      weekday: format(activity.date, { weekday: "long" }),
    },
    when: format(activity.date, { weekday: "long", day: "numeric", month: "long", year: "numeric" }).replace(",", ""),
    time: [clock(activity.start_time), clock(activity.end_time)].filter(Boolean).join(" – "),
    location: activity.location || "",
    photos: pics,
    cover: pics[0]?.url || null,
    paragraphs: paragraphs(activity.details),
  };
}

export function splitActivities(activities, now = new Date()) {
  const today = todayInZambia(now);
  const items = (activities || []).map(activityItem);
  return {
    upcoming: items.filter((a) => a.date >= today).sort((a, b) => a.date.localeCompare(b.date)),
    past: items.filter((a) => a.date < today).sort((a, b) => b.date.localeCompare(a.date)),
  };
}

// A few items for the branch home page: upcoming activities (soonest first), then
// projects in progress, then planned and finished ones. Past activities aren't shown.
const PROJECT_ORDER = { ongoing: 0, planned: 1, done: 2 };

export function glimpseItems(projects, activities, now = new Date(), most = 3) {
  const { upcoming } = splitActivities(activities, now);
  const ranked = (projects || []).map(projectItem).sort((a, b) => PROJECT_ORDER[a.status.tone] - PROJECT_ORDER[b.status.tone]);
  return [...upcoming, ...ranked].slice(0, most);
}
