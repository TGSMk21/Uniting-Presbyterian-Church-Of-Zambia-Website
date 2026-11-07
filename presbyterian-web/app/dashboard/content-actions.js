"use server";

import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import {
  apiPath,
  isBranchSlug,
  isRowId,
  saveFailure,
  section,
  submittedValues,
  tagsToClear,
  valuesFromForm,
} from "@/Utilities/branchContent.mjs";
import { staffRequest } from "./session";

function allowed(branch, name, id) {
  return isBranchSlug(branch) && Boolean(section(name)) && (id === null || isRowId(id));
}

function done(branch, name, outcome) {
  // Show the change on the public site straight away.
  for (const tag of tagsToClear(name, branch)) updateTag(tag);
  redirect(`/dashboard/content/${branch}/${name}?saved=${outcome}`);
}

// Adds a row when `id` is null, otherwise saves changes to it.
export async function saveBranchContent(branch, name, id, previousState, formData) {
  if (!allowed(branch, name, id)) return { error: "This can't be saved.", fields: {}, values: {} };
  const isNew = id === null;
  const { status, data } = await staffRequest(apiPath(branch, name, id), {
    method: isNew ? "POST" : "PATCH",
    body: valuesFromForm(name, formData, { isNew }),
  });
  if (status === 201 || status === 200) done(branch, name, isNew ? "added" : "changed");

  const failure = saveFailure(name, status, data);
  if (failure.signedOut) redirect("/dashboard/login");
  return { ...failure, values: submittedValues(name, formData) };
}

export async function deleteBranchContent(branch, name, id) {
  if (!allowed(branch, name, id) || id === null || !section(name).canDelete) {
    return { error: "This can't be deleted." };
  }
  const { status } = await staffRequest(apiPath(branch, name, id), { method: "DELETE" });
  // Already gone counts as deleted.
  if (status === 204 || status === 404) done(branch, name, "deleted");
  if (status === 401) redirect("/dashboard/login");
  if (status === 403) return { error: "You can't change this branch's content." };
  return { error: "It couldn't be deleted right now. Please try again in a moment." };
}
