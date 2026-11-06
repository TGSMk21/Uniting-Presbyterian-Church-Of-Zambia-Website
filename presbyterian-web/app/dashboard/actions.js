"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { staffFetch } from "@/Services/staffApi";
import {
  ACCESS_COOKIE,
  ACCESS_MAX_AGE,
  REFRESH_COOKIE,
  REFRESH_MAX_AGE,
  cookieOptions,
  loginFailureMessage,
} from "@/Utilities/staffSession.mjs";

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
  if (status !== 200 || !data?.access || !data?.refresh) {
    return { error: loginFailureMessage(status) };
  }
  await saveTokens(data);
  redirect("/dashboard");
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
