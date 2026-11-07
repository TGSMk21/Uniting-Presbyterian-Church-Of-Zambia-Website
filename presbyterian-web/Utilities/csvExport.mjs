// CSV export from the dashboard (AGENT_EXECUTION_PLAN.md, Task 5.3). The API decides
// which rows a person may export; this file only builds safe addresses.
import { SECTIONS, isBranchSlug } from "./branchContent.mjs";
import { mediaQuery } from "./mediaLibrary.mjs";

export const EXPORT_SECTIONS = [...Object.keys(SECTIONS), "media"];
const FALLBACK = 'attachment; filename="export.csv"';

// The media library's filters, without the page number: an export has every page.
function mediaFilters(params) {
  const query = new URLSearchParams(mediaQuery(params).slice(1));
  query.delete("page");
  const text = query.toString();
  return text ? `?${text}` : "";
}

export function exportApiPath(branch, section, params = {}) {
  if (!isBranchSlug(branch) || !EXPORT_SECTIONS.includes(section)) return null;
  const filters = section === "media" ? mediaFilters(params) : "";
  return `/staff/${encodeURIComponent(branch)}/${section}/export/${filters}`;
}

// The dashboard's own download link. `query` is a list page's query text.
export function exportHref(branch, section, query = "") {
  const params = Object.fromEntries(new URLSearchParams(query));
  const filters = section === "media" ? mediaFilters(params) : "";
  return `/dashboard/content/${branch}/${section}/export${filters}`;
}

export function safeDisposition(value) {
  const match = /^attachment; filename="([a-z0-9-]{1,120}\.csv)"$/.exec(value || "");
  return match ? `attachment; filename="${match[1]}"` : FALLBACK;
}
