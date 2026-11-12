// Staff, branches and change history in the dashboard (AGENT_EXECUTION_PLAN.md, Task 5.4).
// The API decides who may do what; this file only describes forms and lists.
import { isBranchSlug } from "./branchContent.mjs";

// The roles given out in the dashboard. Superusers and finance roles stay in the Django admin.
export const STAFF_ROLES = [
  { value: "content_editor", label: "Content Editor" },
  { value: "elder", label: "Elder / office bearer" },
  { value: "branch_admin", label: "Branch Admin" },
];

// What a minister (Branch Admin) gives their own branch's people (Task 8.1): website
// helpers, or elders, who reach the shared workspace and not the website.
export const BRANCH_ROLES = STAFF_ROLES.filter((role) => role.value !== "branch_admin");
const BRANCH_ROLE_VALUES = new Set(BRANCH_ROLES.map((role) => role.value));

export const HISTORY_SECTIONS = [
  { value: "pages", label: "Pages", noun: "the page" },
  { value: "details", label: "Contact details", noun: "the details of" },
  { value: "sermons", label: "Sermons", noun: "the sermon" },
  { value: "projects", label: "Projects", noun: "the project" },
  { value: "activities", label: "Events", noun: "the event" },
  { value: "ministers", label: "Ministers", noun: "the minister" },
  { value: "services", label: "Service times", noun: "the service time" },
  { value: "messages", label: "Daily messages", noun: "the daily message" },
  { value: "media", label: "Media library", noun: "the file" },
  { value: "people", label: "Staff", noun: "the account" },
  { value: "branches", label: "Branches", noun: "the branch" },
];

export function canManageStaff(staff) {
  return Boolean(staff?.is_superuser || (staff?.role === "branch_admin" && staff?.branch));
}

const text = (formData, key) => String(formData.get(key) ?? "").replace(/\r\n/g, "\n").trim();

export function personFromForm(formData, { superuser, isNew }) {
  const values = {};
  if (isNew) values.username = text(formData, "username");
  for (const key of ["first_name", "last_name", "email"]) values[key] = text(formData, key);
  if (superuser) {
    values.role = text(formData, "role");
    values.branch = text(formData, "branch");
    // The minister this login belongs to (Task 7.1), or none.
    const minister = text(formData, "minister");
    values.minister = /^[1-9][0-9]{0,9}$/.test(minister) ? Number(minister) : null;
  } else if (BRANCH_ROLE_VALUES.has(text(formData, "role"))) {
    values.role = text(formData, "role");
  }
  return values;
}

function failure(status, data, { notFound, refused, boxes }) {
  if (status === 401) return { signedOut: true };
  if (status === 403) return { error: data?.detail || refused, fields: {} };
  if (status === 404) return { error: notFound, fields: {} };
  if (status === 400 && data && typeof data === "object") {
    const fields = {};
    const other = [];
    for (const [key, messages] of Object.entries(data)) {
      const message = [].concat(messages).join(" ");
      if (boxes.includes(key)) fields[key] = message;
      else other.push(message);
    }
    return { error: other.length ? other.join(" ") : null, fields };
  }
  return { error: "Nothing was saved. Please try again in a moment.", fields: {} };
}

export function personFailure(status, data) {
  return failure(status, data, {
    notFound: "This person couldn't be found.",
    refused: "You can't change this person's account.",
    boxes: ["username", "first_name", "last_name", "email", "role", "branch", "minister"],
  });
}

export function personSummary(person) {
  return [
    person.role_label,
    person.branch_name,
    person.minister_name && `Minister: ${person.minister_name}`,
    !person.is_active && "Suspended",
    person.is_active && person.must_change_password && "Hasn't chosen their own password yet",
    person.two_factor_enabled && "Two-step login on",
  ].filter(Boolean).join(" · ");
}

// The minister choices for a superuser, by branch. `username` is the account being
// edited, so its own minister isn't marked as taken.
export function ministerGroups(ministers = [], branches = [], username = "") {
  return branches
    .map(({ slug, name }) => ({
      label: name,
      options: ministers
        .filter((minister) => minister.branch === slug)
        .map(({ id, name: ministerName, account_username: account }) => ({
          value: String(id),
          label: account && account !== username ? `${ministerName} (has an account)` : ministerName,
        })),
    }))
    .filter((group) => group.options.length > 0);
}

export function branchFromForm(formData, { isNew }) {
  const values = { name: text(formData, "name") };
  if (isNew) values.slug = text(formData, "slug");
  values.contact_email = text(formData, "contact_email");
  values.youtube_channel_id = text(formData, "youtube_channel_id");
  // Which presbytery it belongs to (Task 8.1); empty for none.
  if (formData.has("presbytery")) values.presbytery = text(formData, "presbytery") || null;
  if (!isNew) values.is_active = formData.get("is_active") === "on";
  return values;
}

export function branchFailure(status, data) {
  return failure(status, data, {
    notFound: "This branch couldn't be found.",
    refused: "Only superusers can change branches.",
    boxes: ["name", "slug", "contact_email", "youtube_channel_id", "presbytery", "is_active"],
  });
}

const ACTION_WORDS = {
  "password reset": "reset the password of",
  "set-password link made": "made a set-password link for",
  "two-step login reset": "reset two-step login for",
};
const FIELD_WORDS = { is_active: "shown on the website", youtube_channel_id: "YouTube channel" };
const words = (name) => FIELD_WORDS[name] || name.replace(/_/g, " ");

export function changeSummary(entry) {
  const section = HISTORY_SECTIONS.find(({ value }) => value === entry.section);
  const what = section ? `${section.noun} “${entry.target}”` : `“${entry.target}”`;
  const fields = entry.changes?.length ? `: ${entry.changes.map(words).join(", ")}` : "";
  return `${entry.username} ${ACTION_WORDS[entry.action] || entry.action} ${what}${fields}`;
}

export function historyQuery(params = {}) {
  const query = new URLSearchParams();
  const page = typeof params.page === "string" && /^[1-9][0-9]{0,5}$/.test(params.page) ? params.page : "1";
  query.set("page", page);
  const branch = typeof params.branch === "string" ? params.branch.trim() : "";
  if (branch && isBranchSlug(branch)) query.set("branch", branch);
  const person = typeof params.person === "string" ? params.person.trim().slice(0, 150) : "";
  if (person) query.set("person", person);
  const section = typeof params.section === "string" ? params.section : "";
  if (HISTORY_SECTIONS.some(({ value }) => value === section)) query.set("section", section);
  return `?${query}`;
}
