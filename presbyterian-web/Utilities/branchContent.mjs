// Each branch's sermons, projects and activities, managed from the dashboard
// (AGENT_EXECUTION_PLAN.md, Task 5.3). The API checks everything again; this file
// only describes the forms and lists.

const LONG_TEXT = 5000;
const TIME_ZONE = "Africa/Lusaka";

export const PROJECT_STATUSES = [
  { value: "PENDING", label: "Not started" },
  { value: "ONGOING", label: "In progress" },
  { value: "COMPLETED", label: "Finished" },
];

export const SECTIONS = {
  sermons: {
    label: "Sermons",
    singular: "sermon",
    adding: "Add a sermon",
    intro: "Sermons from your YouTube channel appear here by themselves. Change their wording, or hide one you don't want on the website.",
    canDelete: false,
    publicPath: (branch) => `/${branch}/sermons`,
    fields: [
      { key: "video", label: "YouTube link", type: "text", max: 300, required: true, newOnly: true,
        help: "Copy the link from the video's Share button on YouTube." },
      { key: "title", label: "Title", type: "text", max: 300, required: true },
      { key: "preached_at", label: "Date and time preached", type: "datetime", required: true },
      { key: "series", label: "Series", type: "text", max: 200, help: "Leave empty if it isn't part of a series." },
      { key: "reference_verse", label: "Bible verse", type: "text", max: 100, help: "For example John 3:16." },
      { key: "description", label: "Description", type: "textarea", max: LONG_TEXT },
      { key: "is_hidden", label: "Hide this sermon from the website", type: "checkbox" },
    ],
  },
  projects: {
    label: "Projects",
    singular: "project",
    adding: "Add a project",
    intro: "Projects show on your Projects page with how far along they are.",
    canDelete: true,
    publicPath: (branch) => `/${branch}/projects-and-activities`,
    fields: [
      { key: "title", label: "Title", type: "text", max: 300, required: true },
      { key: "status", label: "Status", type: "select", options: PROJECT_STATUSES, required: true },
      { key: "progress", label: "How far along (percent)", type: "number", min: 0, max: 100, required: true },
      { key: "start_date", label: "Start date", type: "date", required: true },
      { key: "end_date", label: "End date", type: "date", help: "Leave empty if you don't know yet." },
      { key: "description", label: "Description", type: "textarea", max: LONG_TEXT, required: true },
    ],
  },
  activities: {
    label: "Activities",
    singular: "activity",
    adding: "Add an activity",
    intro: "Activities show on your Projects page, and upcoming ones on the national home page too.",
    canDelete: true,
    publicPath: (branch) => `/${branch}/projects-and-activities`,
    fields: [
      { key: "title", label: "Title", type: "text", max: 300, required: true },
      { key: "date", label: "Date", type: "date", required: true },
      { key: "start_time", label: "Starts", type: "time", required: true },
      { key: "end_time", label: "Ends", type: "time", required: true },
      { key: "location", label: "Where", type: "text", max: 300, required: true },
      { key: "details", label: "Details", type: "textarea", max: LONG_TEXT, required: true },
    ],
  },
};

export const NEW_DEFAULTS = {
  sermons: {},
  projects: { status: "PENDING", progress: "0" },
  activities: {},
};

export function section(name) {
  return Object.hasOwn(SECTIONS, name) ? SECTIONS[name] : undefined;
}

// Only safe pieces go into API addresses.
export function isBranchSlug(value) {
  return typeof value === "string" && /^[-a-zA-Z0-9_]{1,50}$/.test(value);
}

export function isRowId(value) {
  return typeof value === "string" && /^[1-9][0-9]{0,9}$/.test(value);
}

export function apiPath(branch, name, id) {
  return `/staff/${encodeURIComponent(branch)}/${name}/${id ? `${id}/` : ""}`;
}

// The website's cached copies, cleared when staff save.
export function sectionTag(name, branch) {
  return `${name}:${branch}`;
}

export const UPCOMING_ACTIVITIES_TAG = "activities:upcoming";

export function tagsToClear(name, branch) {
  const tags = [sectionTag(name, branch)];
  if (name === "activities") tags.push(UPCOMING_ACTIVITIES_TAG);
  return tags;
}

// The form's boxes, as the API expects them. Empty optional dates are cleared;
// fields only shown when adding are left out of edits.
export function valuesFromForm(name, formData, { isNew }) {
  const values = {};
  for (const field of SECTIONS[name].fields) {
    if (field.newOnly && !isNew) continue;
    const raw = formData.get(field.key);
    if (field.type === "checkbox") {
      values[field.key] = raw === "on";
      continue;
    }
    const text = String(raw ?? "").replace(/\r\n/g, "\n").trim();
    if (field.type === "date" && !field.required && !text) values[field.key] = null;
    else values[field.key] = text;
  }
  return values;
}

// A saved row's values, ready to show in the form's boxes.
export function formValues(name, row) {
  const values = {};
  for (const field of SECTIONS[name].fields) {
    const value = row?.[field.key];
    if (field.type === "checkbox") values[field.key] = Boolean(value);
    else if (value === null || value === undefined) values[field.key] = "";
    // The API answers in Zambian time, such as 2026-11-08T10:00:00+02:00.
    else if (field.type === "datetime") values[field.key] = String(value).slice(0, 16);
    else if (field.type === "time") values[field.key] = String(value).slice(0, 5);
    else values[field.key] = String(value);
  }
  return values;
}

// What was typed, to put back in the boxes when a save is refused. React clears
// a form after its action runs, back to each box's starting value.
export function submittedValues(name, formData) {
  return Object.fromEntries(
    SECTIONS[name].fields.map((field) => [
      field.key,
      field.type === "checkbox" ? formData.get(field.key) === "on" : String(formData.get(field.key) ?? ""),
    ]),
  );
}

// The API's complaints, by box. Anything not tied to a box goes in `error`.
export function saveFailure(name, status, data) {
  if (status === 401) return { signedOut: true };
  if (status === 403) return { error: "You can't change this branch's content.", fields: {} };
  if (status === 404) return { error: `This ${SECTIONS[name].singular} no longer exists.`, fields: {} };
  if (status === 400 && data && typeof data === "object") {
    const keys = new Set(SECTIONS[name].fields.map(({ key }) => key));
    const fields = {};
    const other = [];
    for (const [key, messages] of Object.entries(data)) {
      const text = [].concat(messages).join(" ");
      if (keys.has(key)) fields[key] = text;
      else other.push(text);
    }
    return { error: other.length ? other.join(" ") : null, fields };
  }
  return { error: "Nothing was saved. Please try again in a moment.", fields: {} };
}

function formatted(date, options) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: TIME_ZONE, ...options }).format(date);
}

// What the list shows under each title.
export function rowSummary(name, row) {
  if (name === "sermons") {
    const when = row.preached_at ? formatted(new Date(row.preached_at), { day: "numeric", month: "short", year: "numeric" }) : "";
    return [when, row.series].filter(Boolean).join(" · ");
  }
  if (name === "projects") {
    const status = PROJECT_STATUSES.find(({ value }) => value === row.status)?.label || row.status;
    return `${status} · ${row.progress}%`;
  }
  // A date on its own is a calendar day, so it's read as such rather than as a moment.
  const day = row.date ? formatted(new Date(`${row.date}T12:00:00Z`), { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "";
  const times = [row.start_time, row.end_time].filter(Boolean).map((t) => t.slice(0, 5)).join("–");
  return [day, times, row.location].filter(Boolean).join(" · ");
}

// Which branches this person can manage. The API enforces the same rules.
export function manageableBranches(staff, branches = []) {
  if (staff.is_superuser) return branches.map(({ slug, name }) => ({ slug, name }));
  if (staff.branch && ["branch_admin", "content_editor"].includes(staff.role)) {
    return [{ slug: staff.branch.slug, name: staff.branch.name }];
  }
  return [];
}
