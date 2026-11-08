// "My branch" (owner's request, 2026-11-08). A member picks their branch once; it is
// remembered in their own browser (nothing personal, nothing on our server) and the
// main link then takes them there.

export const BRANCH_COOKIE = "upcz-branch";
// Set for the rest of a visit once someone asks for the church-wide site.
export const STAY_COOKIE = "upcz-stay";
const ONE_YEAR = 365 * 24 * 60 * 60;

export function isBranchSlug(value) {
  return typeof value === "string" && /^[a-z0-9][a-z0-9-]{0,60}$/.test(value);
}

export function readBranchCookie(cookieHeader) {
  const found = String(cookieHeader || "").split(";").map((part) => part.trim())
    .find((part) => part.startsWith(`${BRANCH_COOKIE}=`));
  if (!found) return null;
  let value;
  try { value = decodeURIComponent(found.slice(BRANCH_COOKIE.length + 1)); } catch { return null; }
  return isBranchSlug(value) ? value : null;
}

export function branchCookie(slug, { secure = true } = {}) {
  if (!isBranchSlug(slug)) throw new Error("Not a branch address");
  return `${BRANCH_COOKIE}=${slug}; Max-Age=${ONE_YEAR}; Path=/; SameSite=Lax${secure ? "; Secure" : ""}`;
}

// Where the main link should go, or null to show the national page.
export function homeRedirect({ branch, all = false, stay = false }) {
  if (all || stay || !isBranchSlug(branch)) return null;
  return `/${branch}`;
}
