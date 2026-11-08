// Each branch's sermons, projects, activities, ministers, service times and daily messages, managed
// from the dashboard (AGENT_EXECUTION_PLAN.md, Task 5.3). The API checks everything
// again; this file only describes the forms and lists.
import { branchTag } from "./pageContent.mjs";

const LONG_TEXT = 5000;
const TIME_ZONE = "Africa/Lusaka";
const ORDER = {
  key: "order", label: "Order on the page", type: "number", min: 0, max: 999, required: true,
  help: "Lower numbers come first.",
};

// Uploaded on its own, like page photos.
export const MINISTER_PHOTO = { key: "photo", label: "Photo", default: "", max_side: 800 };

export const PROJECT_STATUSES = [
  { value: "PENDING", label: "Not started" },
  { value: "ONGOING", label: "In progress" },
  { value: "COMPLETED", label: "Finished" },
];

// Drafts and turned-down messages stay off the website. Phase 4's AI drafts arrive
// as drafts for staff to check.
export const MESSAGE_STATUSES = [
  { value: "pending_review", label: "Draft (not on the website)" },
  { value: "published", label: "Published" },
  { value: "rejected", label: "Turned down (not on the website)" },
];

export const SECTIONS = {
  sermons: {
    sorts: [{ value: "", label: "Newest first" }, { value: "preached_at", label: "Oldest first" }, { value: "title", label: "Title A–Z" }],
    summary: "Sermon videos from your YouTube channel",
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
    sorts: [{ value: "", label: "Newest added first" }, { value: "start_date", label: "Earliest start first" }, { value: "title", label: "Title A–Z" }],
    summary: "Building and outreach projects, with progress",
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
    sorts: [{ value: "", label: "Latest date first" }, { value: "date", label: "Earliest date first" }, { value: "title", label: "Title A–Z" }],
    summary: "Events, also shown on the national home page",
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
  ministers: {
    summary: "Ministers, their photos and AI draft settings",
    label: "Ministers",
    singular: "minister",
    adding: "Add a minister",
    intro: "The first minister in this list is shown on your About page. Open a minister to add their photo.",
    canDelete: true,
    publicPath: (branch) => `/${branch}/about`,
    fields: [
      { key: "name", label: "Name", type: "text", max: 200, required: true,
        help: "Without “Rev.”, which the website adds." },
      { key: "bio", label: "About them", type: "textarea", max: LONG_TEXT,
        help: "Leave an empty line between paragraphs." },
      { ...ORDER, help: "Lower numbers come first. Give the minister for your About page the lowest." },
      // Daily message drafts written by AI from their written sermons (Phase 4).
      { key: "ai_drafts", label: "Write a daily message draft from their written sermons each day", type: "checkbox",
        help: "Drafts appear in Daily messages for you to check and publish; nothing is published by itself. Their written sermons are sent to Google's Gemini AI to do this." },
      { key: "style_notes", label: "How they write", type: "textarea", max: LONG_TEXT,
        help: "For the drafts. For example: short sentences, a question to think about, ends with a short prayer." },
    ],
  },
  services: {
    summary: "Regular service days and times",
    label: "Service times",
    singular: "service time",
    adding: "Add a service time",
    intro: "Service times show on your home page, your About page and Find a Branch.",
    canDelete: true,
    publicPath: (branch) => `/${branch}#schedule`,
    fields: [
      { key: "day", label: "Day", type: "text", max: 50, required: true, help: "For example Every Sunday." },
      { key: "title", label: "Name of the service", type: "text", max: 200, required: true },
      { key: "start_time", label: "Starts", type: "time", required: true },
      { key: "end_time", label: "Ends", type: "time", required: true },
      { key: "location", label: "Where", type: "text", max: 200 },
      { key: "details", label: "Details", type: "text", max: 200, help: "For example Worship · Word · Communion." },
      ORDER,
    ],
  },
  messages: {
    sorts: [{ value: "", label: "Latest day first" }, { value: "date", label: "Earliest day first" }, { value: "title", label: "Title A–Z" }],
    summary: "The message on your home page each day",
    // Tabs above the list, as ?status= (Task 7.3).
    filters: [
      { value: "", label: "All" },
      { value: "pending_review", label: "To check" },
      { value: "published", label: "Published" },
      { value: "rejected", label: "Turned down" },
    ],
    label: "Daily messages",
    singular: "daily message",
    adding: "Write a daily message",
    intro: "Your home page shows the newest published message whose day has come, until the next one. Ministers with daily message drafts turned on get an AI draft for each day, to check and publish.",
    canDelete: true,
    publicPath: (branch) => `/${branch}`,
    fields: [
      // The page fills in the branch's ministers.
      { key: "minister", label: "From", type: "select", choices: "ministers", required: true },
      { key: "date", label: "Day", type: "date", required: true,
        help: "It shows on your home page from this day." },
      { key: "title", label: "Title", type: "text", max: 300, required: true },
      { key: "reference_verse", label: "Bible verse", type: "text", max: 100, help: "For example Psalm 119:105." },
      { key: "verse_text", label: "The verse itself", type: "textarea", max: 2000,
        help: "Shown above the message. Leave empty to show your home page's usual verse." },
      { key: "message", label: "Message", type: "textarea", max: 10000, required: true,
        help: "Leave an empty line between paragraphs." },
      { key: "status", label: "Status", type: "select", options: MESSAGE_STATUSES, required: true,
        help: "Only published messages show on the website." },
    ],
  },
  // Pastors' sermons, for the AI's daily message drafts (Task 4.1). Never on the website.
  writings: {
    sorts: [{ value: "", label: "Newest added first" }, { value: "-preached_on", label: "Latest preached first" }, { value: "title", label: "Title A–Z" }],
    summary: "Sermons the AI drafts are written from",
    label: "Written sermons",
    singular: "written sermon",
    adding: "Paste a written sermon",
    intro: "Your ministers' sermons, for the daily message drafts. Only your branch's staff can see them; they're never shown on the website.",
    canDelete: true,
    uploads: true,
    publicPath: null,
    fields: [
      { key: "minister", label: "Preached by", type: "select", choices: "ministers", required: true },
      { key: "title", label: "Title", type: "text", max: 300, required: true },
      { key: "preached_on", label: "Date preached", type: "date" },
      { key: "text", label: "The sermon", type: "textarea", max: 200000, rows: 20, required: true,
        help: "Paste the whole sermon. Leave an empty line between paragraphs." },
    ],
  },
};

export const NEW_DEFAULTS = {
  sermons: {},
  projects: { status: "PENDING", progress: "0" },
  activities: {},
  ministers: { order: "0" },
  services: { order: "0" },
  messages: { status: "pending_review" },
  writings: {},
};

// The calendar day in Zambia, as YYYY-MM-DD.
export function todayInZambia(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

// Choices for the minister box.
export function ministerChoices(ministers = []) {
  return (ministers || []).map(({ id, name }) => ({ value: String(id), label: name }));
}

// What a new row's boxes start with. A new message is a draft for today.
export function newRowDefaults(name, { ministers = [], now = new Date() } = {}) {
  const firstMinister = ministers[0] ? String(ministers[0].id) : "";
  if (name === "writings") return { ...NEW_DEFAULTS.writings, minister: firstMinister };
  if (name !== "messages") return NEW_DEFAULTS[name];
  return { ...NEW_DEFAULTS.messages, date: todayInZambia(now), minister: firstMinister };
}

export function section(name) {
  return Object.hasOwn(SECTIONS, name) ? SECTIONS[name] : undefined;
}

// A list page's address, made safe: only listed statuses and sorts reach the API.
// `keep` carries the choices into the page's own links, such as the pager.
export function listQuery(name, params = {}) {
  const spec = section(name);
  const page = isRowId(params.page) ? Number(params.page) : 1;
  const status = spec?.filters?.some(({ value }) => value && value === params.status) ? params.status : "";
  const sort = spec?.sorts?.some(({ value }) => value && value === params.sort) ? params.sort : "";
  const api = new URLSearchParams({ page: String(page) });
  const keep = new URLSearchParams();
  if (status) {
    api.set("status", status);
    keep.set("status", status);
  }
  if (sort) {
    api.set("ordering", sort);
    keep.set("sort", sort);
  }
  return { page, status, sort, api: `?${api}`, keep: keep.toString() };
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
export const BRANCH_LIST_TAG = "branches";

export function tagsToClear(name, branch) {
  // Never on the website, so there's nothing to clear.
  if (SECTIONS[name]?.publicPath === null) return [];
  // Service times come with the branch itself, and with the list in Find a Branch.
  if (name === "services") return [branchTag(branch), BRANCH_LIST_TAG];
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

export function rowTitle(row) {
  return row.title ?? row.name ?? "";
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
  if (name === "ministers") return `Order ${row.order} · ${row.photo ? "Has a photo" : "No photo yet"}`;
  if (name === "messages") {
    const day = row.date ? formatted(new Date(`${row.date}T12:00:00Z`), { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "";
    // The status is shown as a label beside it (rowBadges).
    return [day, row.minister_name].filter(Boolean).join(" · ");
  }
  if (name === "writings") {
    const day = row.preached_on ? formatted(new Date(`${row.preached_on}T12:00:00Z`), { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "";
    const words = `${new Intl.NumberFormat("en-GB").format(row.word_count)} ${row.word_count === 1 ? "word" : "words"}`;
    let state = "Waiting to be read";
    if (row.ready) state = "Ready for daily messages";
    // Only read, and sent to the AI, for ministers with drafts on.
    else if (row.minister_ai_drafts === false) state = "Drafts are off for this minister";
    return [day, row.minister_name, words, state].filter(Boolean).join(" · ");
  }
  if (name === "services") {
    const times = [row.start_time, row.end_time].filter(Boolean).map((t) => t.slice(0, 5)).join("–");
    return [row.day, times, row.location].filter(Boolean).join(" · ");
  }
  // A date on its own is a calendar day, so it's read as such rather than as a moment.
  const day = row.date ? formatted(new Date(`${row.date}T12:00:00Z`), { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "";
  const times = [row.start_time, row.end_time].filter(Boolean).map((t) => t.slice(0, 5)).join("–");
  return [day, times, row.location].filter(Boolean).join(" · ");
}

// Short coloured labels beside a row in a list (Task 7.3).
export function rowBadges(name, row) {
  if (name === "messages") {
    if (row.status === "published") return [{ text: "Published", tone: "success" }];
    if (row.status === "rejected") return [{ text: "Turned down", tone: "neutral" }];
    return [row.ai_generated ? { text: "AI draft", tone: "warning" } : { text: "Draft", tone: "neutral" }];
  }
  if (name === "sermons") {
    if (row.is_live) return [{ text: "Live now", tone: "live" }];
    if (row.is_hidden) return [{ text: "Hidden", tone: "neutral" }];
  }
  return [];
}

// Shown above an AI draft's form: where it came from, and what to check.
export function aiDraftNote({ ai_generated, source_titles = [] }) {
  if (!ai_generated) return null;
  const from = source_titles.length ? ` from these sermons: ${source_titles.join(", ")}` : "";
  return `Written by AI${from}. Please read it carefully, and check the verse's words in your Bible, before publishing.`;
}

// Shown above a published message's form.
export function publishedNote({ published_at, reviewed_by_name }) {
  const when = new Date(published_at);
  const day = formatted(when, { day: "numeric", month: "short", year: "numeric" });
  const time = formatted(when, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  return `Published on ${day} at ${time}${reviewed_by_name ? ` by ${reviewed_by_name}` : ""}.`;
}

// Which branches this person can manage. The API enforces the same rules.
export function manageableBranches(staff, branches = []) {
  if (staff.is_superuser) return branches.map(({ slug, name }) => ({ slug, name }));
  if (staff.branch && ["branch_admin", "content_editor"].includes(staff.role)) {
    return [{ slug: staff.branch.slug, name: staff.branch.name }];
  }
  return [];
}
