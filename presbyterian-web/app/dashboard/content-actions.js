"use server";

import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { imageFailure } from "@/Utilities/imageUpload.mjs";
import { detailsFailure, detailsFromForm, detailsTags } from "@/Utilities/branchDetails.mjs";
import { mediaEdits, mediaFailure } from "@/Utilities/mediaLibrary.mjs";
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
  const { status, data } = await staffRequest(apiPath(branch, name, id), { method: "DELETE" });
  // Already gone counts as deleted.
  if (status === 204 || status === 404) done(branch, name, "deleted");
  if (status === 401) redirect("/dashboard/login");
  if (status === 403) return { error: "You can't change this branch's content." };
  // Such as a minister who has daily messages.
  if (status === 409 && data?.detail) return { error: data.detail };
  return { error: "It couldn't be deleted right now. Please try again in a moment." };
}

// The API re-saves the photo and sends it to storage, and may be waking from sleep.
const UPLOAD_TIMEOUT_MS = 45000;

function photoOutcome(branch, { status, data }) {
  if (status === 200) {
    for (const tag of tagsToClear("ministers", branch)) updateTag(tag);
    return { url: data.url };
  }
  if (status === 403) return { error: "You can't change this branch's content." };
  if (status === 404) return { error: "This minister no longer exists." };
  return imageFailure(status, data);
}

function photoPath(branch, id) {
  return `${apiPath(branch, "ministers", id)}photo/`;
}

export async function uploadMinisterPhoto(branch, id, formData) {
  const file = formData.get("image");
  if (!allowed(branch, "ministers", id) || id === null || !(file instanceof File)) return imageFailure(0);
  const upload = new FormData();
  upload.append("image", file);
  return photoOutcome(
    branch,
    await staffRequest(photoPath(branch, id), { method: "POST", formData: upload, timeoutMs: UPLOAD_TIMEOUT_MS }),
  );
}

export async function removeMinisterPhoto(branch, id) {
  if (!allowed(branch, "ministers", id) || id === null) return imageFailure(0);
  return photoOutcome(branch, await staffRequest(photoPath(branch, id), { method: "DELETE" }));
}

export async function saveBranchDetails(branch, previousState, formData) {
  const typed = {
    contact_email: String(formData.get("contact_email") ?? ""),
    contact_phone: String(formData.get("contact_phone") ?? ""),
    address: String(formData.get("address") ?? ""),
    location_confirmed: formData.get("location_confirmed") === "on",
  };
  if (!isBranchSlug(branch)) return { saved: false, error: "This can't be saved.", fields: {}, values: typed };
  const { values, errors } = detailsFromForm(formData);
  if (Object.keys(errors).length) return { saved: false, error: null, fields: errors, values: typed };

  const { status, data } = await staffRequest(`/staff/${encodeURIComponent(branch)}/details/`, {
    method: "PATCH",
    body: values,
  });
  if (status === 200) {
    // Show the change on the public site straight away.
    for (const tag of detailsTags(branch)) updateTag(tag);
    return { saved: true, error: null, fields: {}, values: typed };
  }
  const failure = detailsFailure(status, data);
  if (failure.signedOut) redirect("/dashboard/login");
  return { saved: false, ...failure, values: typed };
}

// The media library. Files are only ever sent to the API, which keeps them private.
function mediaPath(branch, id) {
  return `/staff/${encodeURIComponent(branch)}/media/${id ? `${id}/` : ""}`;
}

function mediaAllowed(branch, id) {
  return isBranchSlug(branch) && (id === null || isRowId(id));
}

export async function uploadMedia(branch, formData) {
  const file = formData.get("file");
  if (!mediaAllowed(branch, null) || !(file instanceof File)) return { error: "Please choose a file.", fields: {} };
  const upload = new FormData();
  upload.append("file", file, file.name || "file");
  for (const key of ["title", "description", "tags"]) {
    const value = String(formData.get(key) ?? "").trim();
    if (value) upload.append(key, value);
  }
  const { status, data } = await staffRequest(mediaPath(branch), {
    method: "POST",
    formData: upload,
    timeoutMs: UPLOAD_TIMEOUT_MS,
  });
  if (status === 201) return { id: data.id };
  const failure = mediaFailure(status, data);
  if (failure.signedOut) redirect("/dashboard/login");
  return failure;
}

export async function saveMedia(branch, id, previousState, formData) {
  const values = mediaEdits(formData);
  if (!mediaAllowed(branch, id) || id === null) return { error: "This can't be saved.", fields: {}, values };
  const { status, data } = await staffRequest(mediaPath(branch, id), { method: "PATCH", body: values });
  if (status === 200) redirect(`/dashboard/content/${branch}/media?saved=changed`);
  const failure = mediaFailure(status, data);
  if (failure.signedOut) redirect("/dashboard/login");
  return { ...failure, values };
}

export async function deleteMedia(branch, id) {
  if (!mediaAllowed(branch, id) || id === null) return { error: "This can't be deleted." };
  const { status } = await staffRequest(mediaPath(branch, id), { method: "DELETE" });
  // Already gone counts as deleted.
  if (status === 204 || status === 404) redirect(`/dashboard/content/${branch}/media?saved=deleted`);
  if (status === 401) redirect("/dashboard/login");
  if (status === 403) return { error: "You can't change this branch's files." };
  return { error: "It couldn't be deleted right now. Please try again in a moment." };
}
