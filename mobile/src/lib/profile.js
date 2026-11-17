export const SLUG_RE = /^[a-z0-9-]+$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function emptyProfile() {
  return { name: "", branchSlug: "", email: "" };
}

export function normalizeName(name) {
  return String(name ?? "").replace(/\s+/g, " ").trim().slice(0, 40);
}

export function initialOf(name) {
  const first = normalizeName(name)[0];
  return first ? first.toUpperCase() : "";
}

export function profileErrors({ email }) {
  const trimmed = String(email ?? "").trim();
  return { email: trimmed && !EMAIL_RE.test(trimmed) ? "That email address doesn't look right." : null };
}

export function profileFromForm({ name, branchSlug, email }) {
  const slug = String(branchSlug ?? "").trim();
  return {
    name: normalizeName(name),
    branchSlug: SLUG_RE.test(slug) ? slug : "",
    email: String(email ?? "").trim().toLowerCase(),
  };
}
