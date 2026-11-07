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

const LOGIN_PATH = "/dashboard/login";

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

export const config = { matcher: ["/dashboard/:path*"] };
