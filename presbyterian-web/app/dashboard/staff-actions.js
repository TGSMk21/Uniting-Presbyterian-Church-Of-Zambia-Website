"use server";

import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { BRANCH_LIST_TAG, isBranchSlug, isRowId } from "@/Utilities/branchContent.mjs";
import { branchTag } from "@/Utilities/pageContent.mjs";
import { setPasswordAddress, shareMessage } from "@/Utilities/accessRequests.mjs";
import { branchFailure, branchFromForm, personFailure, personFromForm } from "@/Utilities/staffAdmin.mjs";
import { currentStaff, staffRequest } from "./session";
import { siteOrigin } from "./site-origin";

const PERSON_ACTIONS = new Set(["suspend", "restore", "reset-password", "reset-two-factor"]);

async function isSuperuser() {
  const { status, data } = await currentStaff();
  return status === 200 && Boolean(data?.is_superuser);
}

function typed(formData) {
  return Object.fromEntries([...formData.keys()].filter((key) => !key.startsWith("$")).map((key) => [key, String(formData.get(key) ?? "")]));
}

// The set-password link and the message to send with it, shown once (Task 7.2).
async function handover(person, { reset = false } = {}) {
  const link = setPasswordAddress(await siteOrigin(), person.link_token);
  return { link, message: shareMessage({ firstName: person.first_name, username: person.username, link, reset }) };
}

// Adds someone. Their set-password link comes back once, to be shown and passed on.
export async function addPerson(previousState, formData) {
  const values = personFromForm(formData, { superuser: await isSuperuser(), isNew: true });
  const { status, data } = await staffRequest("/staff-people/", { method: "POST", body: values });
  if (status === 201) {
    return { added: { id: data.id, username: data.username, ...(await handover(data)) }, error: null, fields: {}, values: {} };
  }
  const outcome = personFailure(status, data);
  if (outcome.signedOut) redirect("/dashboard/login");
  return { added: null, ...outcome, values: typed(formData) };
}

export async function savePerson(id, previousState, formData) {
  if (!isRowId(id)) return { error: "This can't be saved.", fields: {}, values: typed(formData) };
  const values = personFromForm(formData, { superuser: await isSuperuser(), isNew: false });
  const { status, data } = await staffRequest(`/staff-people/${id}/`, { method: "PATCH", body: values });
  if (status === 200) redirect(`/dashboard/staff/${id}?saved=changed`);
  const outcome = personFailure(status, data);
  if (outcome.signedOut) redirect("/dashboard/login");
  return { ...outcome, values: typed(formData) };
}

// Suspend, restore, or reset a password or two-step login.
export async function personAction(id, kind) {
  if (!isRowId(id) || !PERSON_ACTIONS.has(kind)) return { error: "This can't be done." };
  const { status, data } = await staffRequest(`/staff-people/${id}/${kind}/`, { method: "POST" });
  if (status === 200) return { done: kind, handover: data.link_token ? await handover(data, { reset: true }) : null };
  const outcome = personFailure(status, data);
  if (outcome.signedOut) redirect("/dashboard/login");
  return { error: outcome.error || "It couldn't be done right now. Please try again in a moment." };
}

function refreshBranch(slug) {
  // The branch's own pages and the lists of branches.
  updateTag(branchTag(slug));
  updateTag(BRANCH_LIST_TAG);
}

export async function addBranch(previousState, formData) {
  const values = branchFromForm(formData, { isNew: true });
  const { status, data } = await staffRequest("/staff-branches/", { method: "POST", body: values });
  if (status === 201) {
    refreshBranch(data.slug);
    redirect(`/dashboard/branches/${data.slug}?saved=added`);
  }
  const outcome = branchFailure(status, data);
  if (outcome.signedOut) redirect("/dashboard/login");
  return { ...outcome, values: typed(formData) };
}

export async function saveBranch(slug, previousState, formData) {
  if (!isBranchSlug(slug)) return { error: "This can't be saved.", fields: {}, values: typed(formData) };
  const values = branchFromForm(formData, { isNew: false });
  const { status, data } = await staffRequest(`/staff-branches/${encodeURIComponent(slug)}/`, { method: "PATCH", body: values });
  if (status === 200) {
    refreshBranch(slug);
    redirect(`/dashboard/branches/${slug}?saved=changed`);
  }
  const outcome = branchFailure(status, data);
  if (outcome.signedOut) redirect("/dashboard/login");
  return { ...outcome, values: typed(formData) };
}
