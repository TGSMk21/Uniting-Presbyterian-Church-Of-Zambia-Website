"use server";

// The shared workspace's actions (AGENT_EXECUTION_PLAN.md, Phase 8). Each answers
// { ok, ... } or { error } (or { signedOut }); the API checks who may do what.
import { isRowId } from "@/Utilities/workspace.mjs";
import { staffRequest } from "./session";

function problem(status, data, fallback) {
  if (status === 401) return { signedOut: true };
  if (status === 403 || status === 404) return { error: data?.detail || "You can't do that here." };
  if (status === 400 && data && typeof data === "object") {
    return { error: Object.values(data).flat().join(" ") || fallback };
  }
  return { error: fallback };
}

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

// Workspace members by name, optionally within one branch or presbytery.
export async function searchPeople({ q = "", branch = "", presbytery = "" } = {}) {
  const params = new URLSearchParams();
  if (String(q).trim()) params.set("q", String(q).trim().slice(0, 80));
  if (SLUG.test(branch)) params.set("branch", branch);
  if (SLUG.test(presbytery)) params.set("presbytery", presbytery);
  const { status, data } = await staffRequest(`/workspace/people/?${params}`);
  if (status === 200) return { ok: true, people: data };
  return problem(status, data, "People couldn't be found just now.");
}

export async function appointPerson({ person, position, branch = null, presbytery = null }) {
  if (!isRowId(person) || !isRowId(position)) return { error: "Choose a person and a position." };
  const body = { person: Number(person), position: Number(position) };
  if (branch) body.branch = branch;
  if (presbytery) body.presbytery = presbytery;
  const { status, data } = await staffRequest("/workspace/appointments/", { method: "POST", body });
  if (status === 201) return { ok: true, appointment: data };
  return problem(status, data, "The appointment couldn't be saved. Please try again in a moment.");
}

export async function endAppointment(id) {
  if (!isRowId(id)) return { error: "This appointment couldn't be found." };
  const { status, data } = await staffRequest(`/workspace/appointments/${id}/`, { method: "DELETE" });
  if (status === 204) return { ok: true };
  return problem(status, data, "This couldn't be changed. Please try again in a moment.");
}

export async function addPresbytery(previousState, formData) {
  const name = String(formData.get("name") ?? "").trim().slice(0, 100);
  if (!name) return { error: "Please give the presbytery a name." };
  const { status, data } = await staffRequest("/staff-presbyteries/", { method: "POST", body: { name } });
  if (status === 201) return { ok: true, added: data.name };
  return problem(status, data, "The presbytery couldn't be added. Please try again in a moment.");
}
