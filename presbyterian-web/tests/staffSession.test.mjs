// Staff sign-in rules (AGENT_EXECUTION_PLAN.md, Task 5.1). Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  CHALLENGE_COOKIE,
  codeFailureMessage,
  cookieOptions,
  isSignInPage,
  loginFailureMessage,
  needsRefresh,
  serverHeaders,
  sessionAction,
  tokenExpiry,
} from "../Utilities/staffSession.mjs";

const NOW = 1_800_000_000; // seconds

function token(exp) {
  const part = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${part({ alg: "HS256" })}.${part({ exp })}.signature`;
}

test("reads when a token expires", () => {
  assert.equal(tokenExpiry(token(NOW + 60)), NOW + 60);
});

test("a damaged token counts as already expired", () => {
  for (const bad of [undefined, "", "abc", "a.b.c", "a.bm90LWpzb24.c"]) {
    assert.equal(tokenExpiry(bad), 0, String(bad));
  }
});

test("tokens are refreshed shortly before they expire, not after", () => {
  assert.equal(needsRefresh(token(NOW + 600), NOW), false);
  assert.equal(needsRefresh(token(NOW + 30), NOW), true);
  assert.equal(needsRefresh(token(NOW - 1), NOW), true);
  assert.equal(needsRefresh(undefined, NOW), true);
});

test("no session: dashboard pages go to sign-in, the sign-in page opens", () => {
  assert.equal(sessionAction({ now: NOW }), "to-login");
  assert.equal(sessionAction({ isLoginPage: true, now: NOW }), "continue");
});

test("a good access token goes straight through", () => {
  assert.equal(sessionAction({ access: token(NOW + 600), refresh: "r", now: NOW }), "continue");
});

test("an expiring access token is replaced using the refresh token", () => {
  assert.equal(sessionAction({ access: token(NOW + 5), refresh: "r", now: NOW }), "refresh");
  assert.equal(sessionAction({ refresh: "r", now: NOW }), "refresh");
  assert.equal(sessionAction({ refresh: "r", isLoginPage: true, now: NOW }), "refresh");
});

test("an expired access token with no refresh token means signing in again", () => {
  assert.equal(sessionAction({ access: token(NOW - 5), now: NOW }), "to-login");
});

test("link prefetching never uses up a refresh token, which only works once", () => {
  assert.equal(sessionAction({ refresh: "r", isPrefetch: true, now: NOW }), "continue");
});

test("cookies can't be read by page scripts and only go to the dashboard", () => {
  const options = cookieOptions({ maxAge: 60, production: true });
  assert.equal(options.httpOnly, true);
  assert.equal(options.secure, true);
  assert.equal(options.sameSite, "lax");
  assert.equal(options.path, "/dashboard");
  assert.equal(options.maxAge, 60);
});

test("cookie names are distinct", () => {
  assert.equal(new Set([ACCESS_COOKIE, REFRESH_COOKIE, CHALLENGE_COOKIE]).size, 3);
});

test("the API is told who's asking, and given the visitor's first forwarded address", () => {
  const headers = serverHeaders({ secret: "s3", forwardedFor: "198.51.100.7, 10.0.0.1", access: "tok" });
  assert.equal(headers["X-Internal-Secret"], "s3");
  assert.equal(headers["X-Client-Address"], "198.51.100.7");
  assert.equal(headers.Authorization, "Bearer tok");
});

test("no token means no Authorization header", () => {
  assert.equal("Authorization" in serverHeaders({ secret: "s3", forwardedFor: "198.51.100.7" }), false);
});

test("sign-in failures say what to do without revealing whether an account exists", () => {
  assert.match(loginFailureMessage(401), /username or password/i);
  assert.match(loginFailureMessage(429), /15 minutes/);
  for (const status of [404, 500, 503, 0]) {
    assert.match(loginFailureMessage(status), /isn.t available/i, String(status));
  }
});

test("both sign-in steps open without a session; everything else in the dashboard doesn't", () => {
  assert.equal(isSignInPage("/dashboard/login"), true);
  assert.equal(isSignInPage("/dashboard/login/verify"), true);
  // Asking for access and choosing a password from a link happen before anyone has a session (Task 7.2).
  assert.equal(isSignInPage("/dashboard/request-access"), true);
  assert.equal(isSignInPage("/dashboard/set-password"), true);
  for (const path of ["/dashboard", "/dashboard/two-factor", "/dashboard/change-password", "/dashboard/login-history", "/dashboard/requests", "/dashboard/set-password/x"]) {
    assert.equal(isSignInPage(path), false, path);
  }
});

test("code failures say what to do", () => {
  assert.match(codeFailureMessage(401), /code isn.t right/i);
  assert.match(codeFailureMessage(429), /15 minutes/);
  assert.match(codeFailureMessage(0), /isn.t available/i);
});
