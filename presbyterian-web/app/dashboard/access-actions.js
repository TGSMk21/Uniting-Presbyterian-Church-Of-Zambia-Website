"use server";

// Asking for access, approving it, and choosing a password from a link
// (AGENT_EXECUTION_PLAN.md, Task 7.2). The API decides everything; these only pass things on.
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { staffFetch } from "@/Services/staffApi";
import {
  approvalFailure,
  approvalFromForm,
  linkTokenFrom,
  requestFailure,
  requestFromForm,
  setPasswordAddress,
  shareMessage,
} from "@/Utilities/accessRequests.mjs";
import { isRowId } from "@/Utilities/branchContent.mjs";
import { staffRequest } from "./session";
import { siteOrigin } from "./site-origin";

const LINK_GONE = "This link has expired or has already been used. Please ask whoever approved your account for a new one.";
const TRY_AGAIN = "This isn't working right now. Please try again in a few minutes.";

async function forwardedFor() {
  return (await headers()).get("x-forwarded-for");
}

export async function requestAccess(previousState, formData) {
  const values = requestFromForm(formData);
  const { status, data } = await staffFetch("/access-requests/", {
    method: "POST", body: values, forwardedFor: await forwardedFor(),
  });
  if (status === 202) return { sent: true, error: null, fields: {}, values: null };
  return { sent: false, ...requestFailure(status, data), values };
}

export async function checkPasswordLink(token) {
  if (!linkTokenFrom(`#${token}`)) return { error: LINK_GONE };
  const { status, data } = await staffFetch("/auth/password-link/check/", {
    method: "POST", body: { token }, forwardedFor: await forwardedFor(),
  });
  if (status === 200) return { username: data.username, firstName: data.first_name };
  if (status === 404) return { error: LINK_GONE };
  if (status === 429) return { error: "Too many attempts. Please wait an hour and try again." };
  return { error: TRY_AGAIN };
}

export async function setPasswordFromLink(token, previousState, formData) {
  const password = String(formData.get("password") || "");
  if (password !== String(formData.get("confirm") || "")) {
    return { done: false, error: null, fields: { confirm: "The two passwords aren't the same." } };
  }
  if (!linkTokenFrom(`#${token}`)) return { done: false, error: LINK_GONE, fields: {} };
  const { status, data } = await staffFetch("/auth/password-link/use/", {
    method: "POST", body: { token, password }, forwardedFor: await forwardedFor(),
  });
  if (status === 200) return { done: true, username: data.username, error: null, fields: {} };
  if (status === 400 && data?.password) return { done: false, error: null, fields: { password: [].concat(data.password).join(" ") } };
  if (status === 404) return { done: false, error: LINK_GONE, fields: {} };
  if (status === 429) return { done: false, error: "Too many attempts. Please wait an hour and try again.", fields: {} };
  return { done: false, error: TRY_AGAIN, fields: {} };
}

export async function approveRequest(id, { superuser, kind }, previousState, formData) {
  const values = approvalFromForm(formData, { superuser, kind });
  if (!isRowId(String(id))) return { approved: null, error: "This request can't be approved.", fields: {}, values };
  const { status, data } = await staffRequest(`/staff-requests/${id}/approve/`, { method: "POST", body: values });
  if (status === 201) {
    // Shown once, for the approver to send on (decision D3). It isn't kept anywhere.
    const link = setPasswordAddress(await siteOrigin(), data.link_token);
    const firstName = String(data.full_name || "").split(" ")[0];
    return {
      approved: { username: data.username, link, message: shareMessage({ firstName, username: data.username, link }) },
      error: null, fields: {}, values,
    };
  }
  const failure = approvalFailure(status, data);
  if (failure.signedOut) redirect("/dashboard/login");
  return { approved: null, ...failure, values };
}

export async function turnDownRequest(id, previousState, formData) {
  if (!isRowId(String(id))) return { error: "This request can't be turned down." };
  const reason = String(formData.get("reason") || "").replace(/\r\n/g, "\n").trim();
  const { status, data } = await staffRequest(`/staff-requests/${id}/turn-down/`, { method: "POST", body: { reason } });
  if (status === 200) redirect(`/dashboard/requests/${id}?saved=turned-down`);
  if (status === 401) redirect("/dashboard/login");
  if (status === 409) return { error: "This request has already been decided." };
  if (status === 400 && data?.reason) return { error: [].concat(data.reason).join(" ") };
  return { error: "It couldn't be turned down right now. Please try again in a moment." };
}
