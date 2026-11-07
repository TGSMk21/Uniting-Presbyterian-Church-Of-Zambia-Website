// Rules for staff dashboard sessions. The API checks every token; reading the
// expiry here only decides when to ask for a new one.

export const ACCESS_COOKIE = "upcz_access";
export const REFRESH_COOKIE = "upcz_refresh";
export const CHALLENGE_COOKIE = "upcz_challenge";
export const CHALLENGE_MAX_AGE = 5 * 60; // matches the backend
export const ACCESS_MAX_AGE = 15 * 60; // matches SIMPLE_JWT in the backend
export const REFRESH_MAX_AGE = 3 * 24 * 60 * 60;

const REFRESH_EARLY_BY = 60; // seconds

// Seconds since 1970 when the token expires, or 0 if it can't be read.
export function tokenExpiry(token) {
  try {
    const payload = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const { exp } = JSON.parse(atob(payload));
    return typeof exp === "number" ? exp : 0;
  } catch {
    return 0;
  }
}

export function needsRefresh(access, now) {
  return tokenExpiry(access) - REFRESH_EARLY_BY <= now;
}

// Pages that must open without a session: the password step and the code step.
export function isSignInPage(pathname) {
  return pathname === "/dashboard/login" || pathname === "/dashboard/login/verify";
}

// What to do with a dashboard request: "continue", "refresh" or "to-login".
export function sessionAction({ access, refresh, isLoginPage = false, isPrefetch = false, now }) {
  if (!needsRefresh(access, now)) return "continue";
  if (!refresh) return isLoginPage ? "continue" : "to-login";
  // A refresh token works once, so a background prefetch must not spend it.
  if (isPrefetch) return "continue";
  return "refresh";
}

export function cookieOptions({ maxAge, production }) {
  return { httpOnly: true, secure: production, sameSite: "lax", path: "/dashboard", maxAge };
}

// Headers for calls from the website's server to the API.
export function serverHeaders({ secret, forwardedFor, access, json = true }) {
  const headers = {
    // Without one, fetch describes a file upload's body itself.
    ...(json && { "Content-Type": "application/json" }),
    "X-Internal-Secret": secret || "",
    "X-Client-Address": (forwardedFor || "").split(",")[0].trim(),
  };
  if (access) headers.Authorization = `Bearer ${access}`;
  return headers;
}

export function codeFailureMessage(status) {
  if (status === 401) return "That code isn't right. Please try the newest one.";
  if (status === 429) return "Too many attempts. Please wait 15 minutes and try again.";
  return "Sign-in isn't available right now. Please try again in a few minutes.";
}

export function loginFailureMessage(status) {
  if (status === 401) return "That username or password isn't right. Please try again.";
  if (status === 429) return "Too many attempts. Please wait 15 minutes and try again.";
  return "Sign-in isn't available right now. Please try again in a few minutes.";
}
