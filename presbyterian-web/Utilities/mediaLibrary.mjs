// The media library in the dashboard (AGENT_EXECUTION_PLAN.md, Task 5.3). Files stay
// private: the API hands out links that expire after an hour. The API checks every
// file again; nothing here is relied on for safety.

// The website's host refuses requests over 4.5 MB.
export const MAX_FILE_BYTES = 4_000_000;
export const LIBRARY_PHOTO = { max_side: 2560, transparent: false };
export const MEDIA_LIMITS = { title: 200, description: 2000 };
export const ACCEPT = ".jpg,.jpeg,.png,.webp,.pdf,.docx,.xlsx,.pptx,.mp3,.m4a";

export const MEDIA_TYPES = [
  { value: "", label: "All files" },
  { value: "image", label: "Photos" },
  { value: "document", label: "Documents" },
  { value: "audio", label: "Recordings" },
];
const FILTER_TYPES = new Set(["image", "document", "audio"]);
const MAX_FILTER = 100;
const TIME_ZONE = "Africa/Lusaka";

const TOO_LARGE = "This file is too large. Files can be up to 4 MB.";

export function isPhoto(file) {
  return /^image\/(jpeg|png|webp)$/.test(file?.type || "");
}

export function photoSpec(file) {
  return { ...LIBRARY_PHOTO, transparent: file.type === "image/png" };
}

// A message to show instead of uploading, or null when the file can be sent.
export function checkBeforeUpload(file) {
  if (!file) return "Please choose a file.";
  if (file.size === 0) return "This file is empty.";
  if ((file.type || "").startsWith("video/")) return "Videos can't be added here. Please put them on your YouTube channel.";
  if (!isPhoto(file) && file.size > MAX_FILE_BYTES) return TOO_LARGE;
  return null;
}

function single(value) {
  return typeof value === "string" ? value.trim().slice(0, MAX_FILTER) : "";
}

// The list's filters, as safe query text for the API and the page's own links.
export function mediaQuery(params = {}) {
  const query = new URLSearchParams();
  const page = typeof params.page === "string" && /^[1-9][0-9]{0,5}$/.test(params.page) ? params.page : "1";
  query.set("page", page);
  const type = single(params.type);
  if (FILTER_TYPES.has(type)) query.set("type", type);
  const tag = single(params.tag);
  if (tag) query.set("tag", tag);
  const words = single(params.q);
  if (words) query.set("q", words);
  return `?${query}`;
}

export function mediaEdits(formData) {
  const text = (key) => String(formData.get(key) ?? "").replace(/\r\n/g, "\n").trim();
  return { title: text("title"), description: text("description"), tags: text("tags") };
}

export function mediaFailure(status, data) {
  if (status === 401) return { signedOut: true };
  if (status === 403) return { error: "You can't change this branch's files.", fields: {} };
  if (status === 404) return { error: "This file no longer exists.", fields: {} };
  if (status === 413) return { error: TOO_LARGE, fields: {} };
  if (status === 400 && data && typeof data === "object") {
    const boxes = new Set(["file", "title", "description", "tags"]);
    const fields = {};
    const other = [];
    for (const [key, messages] of Object.entries(data)) {
      const text = [].concat(messages).join(" ");
      if (boxes.has(key)) fields[key] = text;
      else other.push(text);
    }
    return { error: other.length ? other.join(" ") : null, fields };
  }
  return { error: "Nothing was saved. Please try again in a moment.", fields: {} };
}

export function tagsText(tags) {
  return (tags || []).join(", ");
}

export function mediaSummary(row) {
  const day = new Intl.DateTimeFormat("en-GB", { timeZone: TIME_ZONE, day: "numeric", month: "short", year: "numeric" })
    .format(new Date(row.uploaded_at));
  const added = `Added ${day}${row.uploaded_by_name ? ` by ${row.uploaded_by_name}` : ""}`;
  return [row.kind, tagsText(row.tags), added].filter(Boolean).join(" · ");
}
