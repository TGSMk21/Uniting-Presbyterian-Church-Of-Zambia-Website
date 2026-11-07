"use server";

import { updateTag } from "next/cache";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { staffFetch } from "@/Services/staffApi";
import {
  ACCESS_COOKIE,
  ACCESS_MAX_AGE,
  CHALLENGE_COOKIE,
  CHALLENGE_MAX_AGE,
  REFRESH_COOKIE,
  REFRESH_MAX_AGE,
  codeFailureMessage,
  cookieOptions,
  loginFailureMessage,
} from "@/Utilities/staffSession.mjs";
import { imageFailure, imageSpec } from "@/Utilities/imageUpload.mjs";
import { NATIONAL, branchTag, contentTag, fieldsFromForm, pageSchema, scopeKind } from "@/Utilities/pageContent.mjs";
import { staffRequest } from "./session";

// The API re-saves the photo and sends it to storage, and may be waking from sleep.
const UPLOAD_TIMEOUT_MS = 45000;

async function forwardedFor() {
  return (await headers()).get("x-forwarded-for");
}

async function saveTokens({ access, refresh }) {
  const store = await cookies();
  const production = process.env.NODE_ENV === "production";
  store.set(ACCESS_COOKIE, access, cookieOptions({ maxAge: ACCESS_MAX_AGE, production }));
  store.set(REFRESH_COOKIE, refresh, cookieOptions({ maxAge: REFRESH_MAX_AGE, production }));
}

async function clearTokens() {
  const store = await cookies();
  store.delete({ name: ACCESS_COOKIE, path: "/dashboard" });
  store.delete({ name: REFRESH_COOKIE, path: "/dashboard" });
  store.delete({ name: CHALLENGE_COOKIE, path: "/dashboard" });
}

export async function signIn(previousState, formData) {
  const username = String(formData.get("username") || "").trim();
  const password = String(formData.get("password") || "");
  if (!username || !password) return { error: "Please enter your username and password." };

  const { status, data } = await staffFetch("/auth/login/", {
    method: "POST",
    body: { username, password },
    forwardedFor: await forwardedFor(),
  });
  if (status === 200 && data?.two_factor_required && data?.challenge) {
    const production = process.env.NODE_ENV === "production";
    (await cookies()).set(CHALLENGE_COOKIE, data.challenge, cookieOptions({ maxAge: CHALLENGE_MAX_AGE, production }));
    redirect("/dashboard/login/verify");
  }
  if (status !== 200 || !data?.access || !data?.refresh) {
    return { error: loginFailureMessage(status) };
  }
  await saveTokens(data);
  redirect("/dashboard");
}

export async function verifyCode(previousState, formData) {
  const code = String(formData.get("code") || "").trim();
  if (!code) return { error: "Please enter your code." };

  const store = await cookies();
  const challenge = store.get(CHALLENGE_COOKIE)?.value;
  if (!challenge) redirect("/dashboard/login");

  const { status, data } = await staffFetch("/auth/login/verify/", {
    method: "POST",
    body: { challenge, code },
    forwardedFor: await forwardedFor(),
  });
  if (status === 200 && data?.access && data?.refresh) {
    store.delete({ name: CHALLENGE_COOKIE, path: "/dashboard" });
    await saveTokens(data);
    redirect("/dashboard");
  }
  if (status === 401 && data?.detail === "Please sign in again.") {
    store.delete({ name: CHALLENGE_COOKIE, path: "/dashboard" });
    redirect("/dashboard/login");
  }
  return { error: codeFailureMessage(status) };
}

export async function confirmTwoFactor(previousState, formData) {
  const code = String(formData.get("code") || "").trim();
  if (!code) return { error: "Please enter the code from your app.", recoveryCodes: null };

  const access = (await cookies()).get(ACCESS_COOKIE)?.value;
  const { status, data } = await staffFetch("/auth/two-factor/confirm/", {
    method: "POST",
    body: { code },
    access,
    forwardedFor: await forwardedFor(),
  });
  if (status === 200 && data?.access && data?.refresh) {
    await saveTokens(data);
    // Stay on this page: the recovery codes are only available now.
    return { error: null, recoveryCodes: data.recovery_codes };
  }
  if (status === 409) redirect("/dashboard");
  if (status === 401 || status === 403) redirect("/dashboard/login");
  if (status === 400) return { error: "That code isn't right. Please try the newest one.", recoveryCodes: null };
  return { error: "Two-step login couldn't be turned on right now. Please try again in a moment.", recoveryCodes: null };
}

export async function savePageContent(scope, page, previousState, formData) {
  const kind = scopeKind(scope);
  if (!pageSchema[kind][page]) return { saved: false, error: "This page can't be edited.", fields: {} };

  const { status, data } = await staffRequest(
    `/page-content/${encodeURIComponent(scope)}/${encodeURIComponent(page)}/`,
    { method: "PUT", body: { fields: fieldsFromForm(kind, page, formData) } },
  );

  if (status === 200) {
    // Show the change on the public site straight away.
    updateTag(contentTag(scope));
    if (scope !== NATIONAL) updateTag(branchTag(scope));
    return { saved: true, error: null, fields: {} };
  }
  if (status === 401) redirect("/dashboard/login");
  if (status === 400 && data?.fields) return { saved: false, error: null, fields: data.fields };
  if (status === 403) return { saved: false, error: "You can't edit this page.", fields: {} };
  return {
    saved: false,
    error: "Your changes couldn't be saved right now. Please try again in a moment.",
    fields: {},
  };
}

function imagePath(scope, page, key) {
  return `/page-content/${encodeURIComponent(scope)}/${encodeURIComponent(page)}/images/${encodeURIComponent(key)}/`;
}

function imageOutcome(scope, { status, data }) {
  if (status !== 200) return imageFailure(status, data);
  // Show the change on the public site straight away.
  updateTag(contentTag(scope));
  if (scope !== NATIONAL) updateTag(branchTag(scope));
  return { url: data.url };
}

export async function uploadPageImage(scope, page, key, formData) {
  const file = formData.get("image");
  if (!imageSpec(scopeKind(scope), page, key) || !(file instanceof File)) return imageFailure(0);

  const upload = new FormData();
  upload.append("image", file);
  return imageOutcome(
    scope,
    await staffRequest(imagePath(scope, page, key), { method: "POST", formData: upload, timeoutMs: UPLOAD_TIMEOUT_MS }),
  );
}

export async function removePageImage(scope, page, key) {
  if (!imageSpec(scopeKind(scope), page, key)) return imageFailure(0);
  return imageOutcome(scope, await staffRequest(imagePath(scope, page, key), { method: "DELETE" }));
}

export async function signOut() {
  const refresh = (await cookies()).get(REFRESH_COOKIE)?.value;
  if (refresh) {
    // End the session on the server too. Sign out here regardless of the answer.
    await staffFetch("/auth/logout/", {
      method: "POST",
      body: { refresh },
      forwardedFor: await forwardedFor(),
    });
  }
  await clearTokens();
  redirect("/dashboard/login");
}

export async function changePassword(previousState, formData) {
  const current = String(formData.get("current") || "");
  const next = String(formData.get("new") || "");
  const confirm = String(formData.get("confirm") || "");
  if (!current || !next || !confirm) return { error: "Please fill in all three fields." };
  if (next !== confirm) return { error: "The new passwords don't match." };

  const access = (await cookies()).get(ACCESS_COOKIE)?.value;
  const { status, data } = await staffFetch("/auth/password/change/", {
    method: "POST",
    body: { current_password: current, new_password: next },
    access,
    forwardedFor: await forwardedFor(),
  });

  if (status === 200 && data?.access && data?.refresh) {
    await saveTokens(data);
    redirect("/dashboard");
  }
  if (status === 401 || status === 403) redirect("/dashboard/login");
  if (status === 400 && data) {
    const messages = [...(data.current_password || []), ...(data.new_password || [])];
    if (messages.length) return { error: messages.join(" ") };
  }
  return { error: "Your password couldn't be changed right now. Please try again in a few minutes." };
}
