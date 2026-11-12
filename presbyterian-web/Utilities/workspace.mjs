// The shared workspace (AGENT_EXECUTION_PLAN.md, Phase 8): plain helpers shared by its
// pages. The API decides who may do what; this only names and arranges things.

export const LEVELS = [
  { value: "branch", label: "Branch" },
  { value: "presbytery", label: "Presbytery" },
  { value: "synod", label: "Synod" },
];

export const SYNOD_NAME = "Synod of Zambia";

export function levelLabel(level) {
  return LEVELS.find((item) => item.value === level)?.label ?? "";
}

// "Munali Presbytery", "Synod of Zambia", or a branch's own name.
export function placeTitle(level, place) {
  if (level === "synod") return SYNOD_NAME;
  if (level === "presbytery") return place ? `${place.name} Presbytery` : "Presbytery";
  return place?.name ?? "";
}

// One row per position at this level: who holds it, or null when nobody does.
export function officeRows(positions, level, officeBearers) {
  return (positions || [])
    .filter((position) => position.level === level)
    .map((position) => ({
      position,
      holder: (officeBearers || []).find((row) => row.title === position.name) ?? null,
    }));
}

export function isRowId(value) {
  return /^[1-9][0-9]{0,9}$/.test(String(value ?? ""));
}

// Notifications only ever open a page inside the dashboard (Task 8.2).
export function safeDashboardLink(link) {
  const value = String(link ?? "");
  return /^\/dashboard\/[A-Za-z0-9/_\-?=&#.]*$/.test(value) && !value.includes("//") ? value : "/dashboard/notifications";
}

export function bellLabel(unread) {
  return unread > 0 ? `Notifications, ${unread} unread` : "Notifications";
}

// Every message in an API refusal, however deeply it's nested, once each.
export function apiMessages(data) {
  const found = [];
  const walk = (value) => {
    if (typeof value === "string") found.push(value);
    else if (Array.isArray(value)) value.forEach(walk);
    else if (value && typeof value === "object") Object.values(value).forEach(walk);
  };
  walk(data);
  return [...new Set(found)].join(" ");
}
