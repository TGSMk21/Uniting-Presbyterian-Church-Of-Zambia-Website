import { plainDashes } from "./plainText.mjs";
// Editable page wording. pageSchema.json lists every field with today's wording as
// its default, and the backend keeps an identical copy (a test there compares them).
// Only changes are stored, so pages always have something to show.
import pageSchema from "./pageSchema.json" with { type: "json" };

export { pageSchema };

export const NATIONAL = "national";

export function scopeKind(scope) {
  return scope === NATIONAL ? NATIONAL : "branch";
}

export function contentTag(scope) {
  return `page-content:${scope}`;
}

export function branchTag(slug) {
  return `branch:${slug}`;
}

function pageFieldSpecs(kind, page) {
  return (pageSchema[kind]?.[page]?.sections || []).flatMap((section) => section.fields);
}

// Everything a page needs: its changed wording over the originals.
export function pageFields(kind, page, overrides, { branchName } = {}) {
  const name = branchName || "our church";
  return Object.fromEntries(
    pageFieldSpecs(kind, page).map(({ key, default: original }) => [
      key,
      plainDashes((overrides?.[key] || original).replaceAll("{branch}", name)),
    ]),
  );
}

// "Love *one* another" → text, emphasis, text. Only ever produces plain text pieces;
// the page renders them as text, so markup typed by staff can't run.
export function parseRichText(text) {
  const tokens = [];
  (text || "").split("\n").forEach((line, index) => {
    if (index > 0) tokens.push({ type: "br" });
    let rest = line;
    let match;
    while ((match = rest.match(/\*([^*]+)\*/))) {
      if (match.index > 0) tokens.push({ type: "text", value: rest.slice(0, match.index) });
      tokens.push({ type: "em", value: match[1] });
      rest = rest.slice(match.index + match[0].length);
    }
    if (rest) tokens.push({ type: "text", value: rest });
  });
  return tokens;
}

export function listLines(text) {
  return (text || "").split("\n").map((line) => line.trim()).filter(Boolean);
}

export function phoneHref(phone) {
  return `tel:${(phone || "").replace(/[^0-9+]/g, "")}`;
}

// Only the page's own wording is sent; a missing field goes back to its original.
// Images change through their own upload.
export function fieldsFromForm(kind, page, formData) {
  return Object.fromEntries(
    pageFieldSpecs(kind, page)
      .filter(({ type }) => type !== "image")
      .map(({ key }) => [key, String(formData.get(key) ?? "")]),
  );
}

export function viewPath(scope, page) {
  const path = pageSchema[scopeKind(scope)][page].path;
  if (scope === NATIONAL) return path;
  return `/${scope}${path}`;
}

// Which sets of pages this person can edit. The API enforces the same rules.
export function editableScopes(staff, branches = []) {
  const national = { scope: NATIONAL, name: "National site" };
  const asScope = ({ slug, name }) => ({ scope: slug, name });
  if (staff.is_superuser) return [national, ...branches.map(asScope)];
  if (staff.role === "super_admin") return [national];
  if (staff.branch && ["branch_admin", "content_editor"].includes(staff.role)) return [asScope(staff.branch)];
  return [];
}
