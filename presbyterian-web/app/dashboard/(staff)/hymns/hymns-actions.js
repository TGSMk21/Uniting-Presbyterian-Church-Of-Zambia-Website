"use server";

import { revalidatePath } from "next/cache";
import { currentStaff, staffRequest } from "../../session";

async function requireSuperuser() {
  const { status, data } = await currentStaff();
  return status === 200 && Boolean(data?.is_superuser);
}

function failure(message) {
  return { error: message };
}

function hymnPayload(formData) {
  const verses = String(formData.get("verses") ?? "")
    .split(/\n{2,}|\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  return {
    collection: String(formData.get("collection") ?? ""),
    number: Number(formData.get("number") ?? 0),
    title: String(formData.get("title") ?? "").trim(),
    verses,
    chorus: String(formData.get("chorus") ?? "").trim(),
    notes: String(formData.get("notes") ?? "").trim(),
  };
}

export async function saveHymn(previousState, formData) {
  if (!(await requireSuperuser())) return failure("Only superusers can change hymns.");
  const id = String(formData.get("id") ?? "");
  const body = hymnPayload(formData);
  const { status, data } = id
    ? await staffRequest(`/staff-hymns/${id}/`, { method: "PATCH", body })
    : await staffRequest("/staff-hymns/", { method: "POST", body });
  if (status !== 200 && status !== 201) {
    return failure(data?.error || Object.values(data ?? {}).flat().join(" ") || `The API answered ${status}.`);
  }
  revalidatePath("/dashboard/hymns");
  return { ok: id ? "Saved." : "Added." };
}

export async function deleteHymn(id) {
  if (!(await requireSuperuser())) return failure("Only superusers can change hymns.");
  const { status } = await staffRequest(`/staff-hymns/${id}/`, { method: "DELETE" });
  if (status !== 204) return failure(`The API answered ${status}.`);
  revalidatePath("/dashboard/hymns");
  return { ok: "Deleted." };
}

export async function importHymns(previousState, formData) {
  if (!(await requireSuperuser())) return failure("Only superusers can change hymns.");
  let hymns;
  try {
    hymns = JSON.parse(String(formData.get("json") ?? ""));
  } catch {
    return failure("That isn't valid JSON. Paste an array of hymns, one object each.");
  }
  const { status, data } = await staffRequest("/staff-hymns/import/", { method: "POST", body: { hymns } });
  if (status !== 200) {
    return failure(data?.error || `The API answered ${status}.`);
  }
  revalidatePath("/dashboard/hymns");
  return { ok: `Imported ${data.total}: ${data.created} new, ${data.updated} updated.` };
}
