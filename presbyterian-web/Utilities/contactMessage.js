// Pure rules for the contact form, kept apart from the server action so they
// can be tested without Resend, Upstash or Next.js.

const LIMITS = { fullName: 100, phoneNumber: 30, email: 254, message: 5000 };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SLUG_RE = /^[a-z0-9_-]+$/i;

export function validateContact(input) {
  const fields = {};
  for (const [name, max] of Object.entries(LIMITS)) {
    const value = String(input?.[name] ?? "").trim();
    if (!value || value.length > max) return { ok: false };
    fields[name] = value;
  }
  if (!EMAIL_RE.test(fields.email)) return { ok: false };
  if (/[\r\n]/.test(fields.fullName)) return { ok: false }; // used in the subject line
  return { ok: true, fields };
}

// x-forwarded-for may list every proxy hop; the client is the first entry.
export function clientIp(forwardedFor) {
  return (forwardedFor || "").split(",")[0].trim() || "127.0.0.1";
}

// The recipient is always looked up server-side from the branch slug (or the
// national address), never taken from the browser.
export async function resolveRecipient(branchSlug, { getBranch, nationalEmail } = {}) {
  if (!branchSlug) return nationalEmail || null;
  if (!SLUG_RE.test(branchSlug)) return null;
  const branch = await getBranch(branchSlug);
  return branch?.contact_email || null;
}
