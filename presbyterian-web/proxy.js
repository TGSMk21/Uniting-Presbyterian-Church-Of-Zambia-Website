import { NextResponse } from "next/server";
import { staffFetch } from "@/Services/staffApi";
import {
  ACCESS_COOKIE,
  ACCESS_MAX_AGE,
  REFRESH_COOKIE,
  REFRESH_MAX_AGE,
  cookieOptions,
  isSignInPage,
  sessionAction,
} from "@/Utilities/staffSession.mjs";

import { BRANCH_COOKIE, STAY_COOKIE, homeRedirect } from "@/Utilities/myBranch.mjs";

const LOGIN_PATH = "/dashboard/login";

// The main link takes a member to the branch they chose (owner's request, 2026-11-08).
// "?all" is the church-wide site, and stays that way for the rest of the visit.
// Search engines keep no cookies, so they always see the national page.
function homeResponse(request) {
  const all = request.nextUrl.searchParams.has("all");
  const target = homeRedirect({
    branch: request.cookies.get(BRANCH_COOKIE)?.value,
    all,
    stay: Boolean(request.cookies.get(STAY_COOKIE)?.value),
  });
  if (target) {
    const response = NextResponse.redirect(new URL(target, request.url));
    // The answer depends on the visitor's cookie, so no shared cache may keep it.
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }
  const response = NextResponse.next();
  // Only a real visit counts: the browser also fetches links in the background (prefetch).
  const prefetch = request.headers.has("next-router-prefetch") || request.headers.get("purpose") === "prefetch";
  if (all && !prefetch) response.cookies.set(STAY_COOKIE, "1", { path: "/", sameSite: "lax", secure: process.env.NODE_ENV === "production" });
  return response;
}

function toLogin(request) {
  const response = NextResponse.redirect(new URL(LOGIN_PATH, request.url));
  response.cookies.delete({ name: ACCESS_COOKIE, path: "/dashboard" });
  response.cookies.delete({ name: REFRESH_COOKIE, path: "/dashboard" });
  return response;
}

// Keeps dashboard sessions going. Pages can't set cookies, so tokens are renewed
// here, before the page runs. Only pages are guarded here: every API call still
// checks the token, role and branch.
export async function proxy(request) {
  if (request.nextUrl.pathname === "/") return homeResponse(request);
  const isLoginPage = isSignInPage(request.nextUrl.pathname);
  const refresh = request.cookies.get(REFRESH_COOKIE)?.value;
  const action = sessionAction({
    access: request.cookies.get(ACCESS_COOKIE)?.value,
    refresh,
    isLoginPage,
    isPrefetch: request.headers.has("next-router-prefetch"),
    now: Date.now() / 1000,
  });

  if (action === "continue") return NextResponse.next();
  if (action === "to-login") return toLogin(request);

  const { status, data } = await staffFetch("/auth/refresh/", {
    method: "POST",
    body: { refresh },
    forwardedFor: request.headers.get("x-forwarded-for"),
  });

  if (status === 200 && data?.access && data?.refresh) {
    const production = process.env.NODE_ENV === "production";
    // The page reads the new tokens from this same request.
    request.cookies.set(ACCESS_COOKIE, data.access);
    request.cookies.set(REFRESH_COOKIE, data.refresh);
    const response = NextResponse.next({ request: { headers: new Headers(request.headers) } });
    response.cookies.set(ACCESS_COOKIE, data.access, cookieOptions({ maxAge: ACCESS_MAX_AGE, production }));
    response.cookies.set(REFRESH_COOKIE, data.refresh, cookieOptions({ maxAge: REFRESH_MAX_AGE, production }));
    return response;
  }

  // The API refused the session, so it's over. If the API just couldn't be
  // reached, keep the session: being signed out by an outage would be wrong.
  if (status === 401 && !isLoginPage) return toLogin(request);
  return NextResponse.next();
}

export const config = { matcher: ["/", "/dashboard/:path*"] };
