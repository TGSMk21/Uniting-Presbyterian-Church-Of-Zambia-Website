// Asking for access, approving it, and choosing a password from a link
// (AGENT_EXECUTION_PLAN.md, Task 7.2). The API checks everything again.

export const KINDS = [
  { value: "minister", label: "I'm a minister of this branch" },
  { value: "staff", label: "I help run this branch (secretary, elder, volunteer)" },
];
export const REQUEST_LIMITS = { full_name: 150, email: 254, phone: 20, note: 1000 };
// The link's secret: 32 random bytes in URL-safe base64 is 43 characters.
const TOKEN = /^[A-Za-z0-9_-]{30,100}$/;
const TIME_ZONE = "Africa/Lusaka";

const text = (formData, key) => String(formData.get(key) ?? "").replace(/\r\n/g, "\n").trim();

export function requestFromForm(formData) {
  const values = {};
  for (const key of ["full_name", "email", "phone", "branch", "kind", "note", "website"]) values[key] = text(formData, key);
  return values;
}

function boxFailure(status, data, boxes, messages) {
  if (status === 401) return { signedOut: true };
  if (status === 400 && data && typeof data === "object") {
    const fields = {};
    const other = [];
    for (const [key, value] of Object.entries(data)) {
      const message = [].concat(value).join(" ");
      if (boxes.includes(key)) fields[key] = message;
      else other.push(message);
    }
    return { error: other.length ? other.join(" ") : null, fields };
  }
  return { error: messages[status] || messages.other, fields: {} };
}

export function requestFailure(status, data) {
  return boxFailure(status, data, ["full_name", "email", "phone", "branch", "kind", "note"], {
    429: "You've sent several requests already. Please wait an hour and try again.",
    other: "Your request couldn't be sent right now. Please try again in a few minutes.",
  });
}

// The secret from the part of the address after #, which browsers never send to a server.
export function linkTokenFrom(hash) {
  const token = String(hash || "").replace(/^#/, "");
  return TOKEN.test(token) ? token : null;
}

export function setPasswordAddress(origin, token) {
  return `${origin}/dashboard/set-password#${token}`;
}

// What the approver sends by WhatsApp or SMS (decision D3).
export function shareMessage({ firstName, username, link, reset = false }) {
  return [
    `Hello ${firstName || "there"},`,
    reset
      ? `Here is a link to choose a new password for your UPCZ staff dashboard account (username ${username}): ${link}`
      : `Your UPCZ staff dashboard account is ready. Your username is ${username}.\nOpen this link to choose your password: ${link}`,
    "The link works once and stops working after 3 days.",
  ].join("\n");
}

export function suggestedUsername(fullName) {
  return String(fullName || "")
    .normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 -]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .join(".")
    .slice(0, 150);
}

export function approvalFromForm(formData, { superuser, kind }) {
  const values = { username: text(formData, "username") };
  if (!superuser) return values;
  if (kind === "minister") values.minister = text(formData, "minister");
  else {
    values.role = text(formData, "role");
    values.branch = text(formData, "branch");
  }
  return values;
}

export function approvalFailure(status, data) {
  return boxFailure(status, data, ["username", "role", "branch", "minister"], {
    403: "You can't approve this request.",
    404: "This request couldn't be found.",
    409: "This request has already been decided.",
    other: "Nothing was approved. Please try again in a moment.",
  });
}

export function requestSummary(row) {
  const asked = new Intl.DateTimeFormat("en-GB", { timeZone: TIME_ZONE, day: "numeric", month: "short", year: "numeric" })
    .format(new Date(row.created_at));
  let state = `Asked ${asked}`;
  if (row.status === "approved") state = `Approved by ${row.decided_by_name}${row.account_username ? ` as ${row.account_username}` : ""}`;
  if (row.status === "turned_down") state = `Turned down by ${row.decided_by_name}`;
  return [row.kind_label, row.branch_name, state].filter(Boolean).join(" · ");
}
