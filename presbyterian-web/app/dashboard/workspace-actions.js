"use server";

// The shared workspace's actions (AGENT_EXECUTION_PLAN.md, Phase 8). Each answers
// { ok, ... } or { error } (or { signedOut }); the API checks who may do what.
import { redirect } from "next/navigation";
import { isRowId, safeDashboardLink } from "@/Utilities/workspace.mjs";
import { meetingFromForm, parsePlace, zambiaTime } from "@/Utilities/meetings.mjs";
import { deliverableFromForm } from "@/Utilities/deliverables.mjs";
import { MAX_TEXT, MAX_UPLOAD, documentFromForm } from "@/Utilities/documents.mjs";
import { staffRequest } from "./session";
import { apiMessages } from "@/Utilities/workspace.mjs";

function problem(status, data, fallback) {
  if (status === 401) return { signedOut: true };
  if (status === 403 || status === 404) return { error: data?.detail || "You can't do that here." };
  if (status === 400 && data && typeof data === "object") return { error: apiMessages(data) || fallback };
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

// Opening a notification marks it read, then goes to its page (Task 8.2).
export async function openNotification(id, link) {
  if (isRowId(id)) await staffRequest(`/workspace/notifications/${id}/read/`, { method: "POST" });
  redirect(safeDashboardLink(link));
}

export async function readAllNotifications() {
  await staffRequest("/workspace/notifications/read-all/", { method: "POST" });
  redirect("/dashboard/notifications");
}

// --- Meetings (Task 8.3) ---------------------------------------------------------------

export async function createMeeting(previousState, formData) {
  const { body, error } = meetingFromForm(formData);
  if (error) return { error };
  const { status, data } = await staffRequest("/workspace/meetings/", { method: "POST", body });
  if (status === 201) redirect(`/dashboard/meetings/${data.id}?planned=1`);
  return problem(status, data, "The meeting couldn't be saved. Please try again in a moment.");
}

export async function updateMeeting(id, previousState, formData) {
  if (!isRowId(id)) return { error: "This meeting couldn't be found." };
  const { body, error } = meetingFromForm(formData, { editing: true });
  if (error) return { error };
  const { status, data } = await staffRequest(`/workspace/meetings/${id}/`, { method: "PATCH", body });
  if (status === 200) redirect(`/dashboard/meetings/${id}?saved=1`);
  return problem(status, data, "The changes couldn't be saved. Please try again in a moment.");
}

async function meetingAction(id, name, body, fallback) {
  if (!isRowId(id)) return { error: "This meeting couldn't be found." };
  const { status, data } = await staffRequest(`/workspace/meetings/${id}/${name}/`, { method: "POST", body });
  if (status === 200 || status === 201) return { ok: true, meeting: data };
  return problem(status, data, fallback);
}

export async function cancelMeeting(id) {
  return meetingAction(id, "cancel", {}, "The meeting couldn't be cancelled. Please try again in a moment.");
}

export async function respondToMeeting(id, response) {
  if (!["attending", "apologies"].includes(response)) return { error: "Choose Attending or Sending apologies." };
  return meetingAction(id, "respond", { response }, "Your answer couldn't be saved. Please try again in a moment.");
}

export async function changeAttendees(id, { add = [], remove = [] }) {
  const clean = (list) => (Array.isArray(list) ? list.filter(isRowId).map(Number).slice(0, 200) : []);
  return meetingAction(id, "attendees", { add: clean(add), remove: clean(remove) },
    "The list couldn't be changed. Please try again in a moment.");
}

export async function recordAttendance(id, present) {
  const clean = Array.isArray(present) ? present.filter(isRowId).map(Number) : [];
  return meetingAction(id, "attendance", { present: clean }, "Attendance couldn't be saved. Please try again in a moment.");
}

export async function copyMeeting(id, previousState, formData) {
  const startsAt = zambiaTime(String(formData.get("date") ?? ""), String(formData.get("start") ?? ""));
  if (!startsAt) return { error: "Please choose the new date and starting time." };
  const result = await meetingAction(id, "copy", { starts_at: startsAt }, "The meeting couldn't be copied just now.");
  if (result.ok) redirect(`/dashboard/meetings/${result.meeting.id}?planned=1`);
  return result;
}

// Ready-made groups to invite for one place, e.g. every Session Clerk in a presbytery.
export async function inviteGroups(placeValue) {
  const where = parsePlace(placeValue);
  if (!where) return { ok: true, groups: [] };
  const params = new URLSearchParams(where);
  const { status, data } = await staffRequest(`/workspace/meetings/groups/?${params}`);
  if (status === 200) return { ok: true, groups: data };
  return problem(status, data, "Groups couldn't be loaded just now.");
}

// A private address a phone's calendar can follow. Making a new one stops the old one.
export async function makeCalendarLink() {
  const { status, data } = await staffRequest("/workspace/calendar-feed/", { method: "POST" });
  if (status === 201) return { ok: true, token: data.token };
  return problem(status, data, "The link couldn't be made just now.");
}

// --- Deliverables and checklists (Task 8.4) --------------------------------------------

export async function applyChecklist(meetingId, templateId) {
  if (!isRowId(templateId)) return { error: "Choose a checklist." };
  return meetingAction(meetingId, "apply-template", { template: Number(templateId) },
    "The checklist couldn't be added. Please try again in a moment.");
}

export async function addDeliverable(meetingId, previousState, formData) {
  const { body, error } = deliverableFromForm(formData, meetingId);
  if (error) return { error };
  const { status, data } = await staffRequest("/workspace/deliverables/", { method: "POST", body });
  if (status === 201) return { ok: true, added: data.title };
  return problem(status, data, "The deliverable couldn't be added. Please try again in a moment.");
}

export async function changeDeliverable(id, { assignee, due_on: dueOn }) {
  if (!isRowId(id)) return { error: "This deliverable couldn't be found." };
  const body = {};
  if (assignee !== undefined) {
    if (assignee !== null && !isRowId(assignee)) return { error: "Please choose the person from the list." };
    body.assignee = assignee === null ? null : Number(assignee);
  }
  if (dueOn !== undefined) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dueOn))) return { error: "Please choose the date it's due." };
    body.due_on = dueOn;
  }
  const { status, data } = await staffRequest(`/workspace/deliverables/${id}/`, { method: "PATCH", body });
  if (status === 200) return { ok: true };
  return problem(status, data, "This couldn't be changed. Please try again in a moment.");
}

export async function removeDeliverable(id) {
  if (!isRowId(id)) return { error: "This deliverable couldn't be found." };
  const { status, data } = await staffRequest(`/workspace/deliverables/${id}/`, { method: "DELETE" });
  if (status === 204) return { ok: true };
  return problem(status, data, "This couldn't be removed. Please try again in a moment.");
}

export async function handIn(id, note = "") {
  if (!isRowId(id)) return { error: "This deliverable couldn't be found." };
  const { status, data } = await staffRequest(`/workspace/deliverables/${id}/submit/`,
    { method: "POST", body: { note: String(note).slice(0, 1000) } });
  if (status === 200) return { ok: true };
  return problem(status, data, "This couldn't be handed in. Please try again in a moment.");
}

export async function reviewDeliverable(id, decision, note = "") {
  if (!isRowId(id)) return { error: "This deliverable couldn't be found." };
  if (!["accept", "changes"].includes(decision)) return { error: "Accept it, or send it back." };
  const { status, data } = await staffRequest(`/workspace/deliverables/${id}/review/`,
    { method: "POST", body: { decision, note: String(note).slice(0, 1000) } });
  if (status === 200) return { ok: true };
  return problem(status, data, "This couldn't be saved. Please try again in a moment.");
}

// The superuser keeps the routine checklists up to date.
export async function saveChecklist(id, { name, items }) {
  const clean = (Array.isArray(items) ? items : []).slice(0, 30).map((item) => ({
    title: String(item.title ?? "").trim().slice(0, 200),
    position: isRowId(item.position) ? Number(item.position) : null,
    for_minister: item.who === "minister",
    days_before: Math.max(0, Math.min(90, Number.parseInt(item.days_before, 10) || 0)),
  }));
  if (clean.some((item) => !item.title)) return { error: "Every line needs a name." };
  const body = { name: String(name ?? "").trim().slice(0, 100), items: clean };
  if (!body.name) return { error: "Please give the checklist a name." };
  const { status, data } = await staffRequest(`/workspace/templates/${id}/`, { method: "PATCH", body });
  if (status === 200) return { ok: true };
  return problem(status, data, "The checklist couldn't be saved. Please try again in a moment.");
}

// --- Documents (Task 8.5) -------------------------------------------------------------

const SHARE_KINDS = new Set(["person", "meeting", "branch", "presbytery", "synod"]);

function cleanTarget(target) {
  if (!target || !SHARE_KINDS.has(target.kind)) return null;
  const out = { kind: target.kind };
  if (target.kind === "person" || target.kind === "meeting") {
    if (!isRowId(target[target.kind])) return null;
    out[target.kind] = Number(target[target.kind]);
  }
  if (target.kind === "branch" || target.kind === "presbytery") {
    if (!SLUG.test(String(target[target.kind] ?? ""))) return null;
    out[target.kind] = target[target.kind];
  }
  return out;
}

async function addDocument(formData) {
  const checked = documentFromForm(formData);
  if (checked.error) return { error: checked.error };
  const { status, data } = await staffRequest("/workspace/documents/", checked.formData
    ? { method: "POST", formData: checked.formData } : { method: "POST", body: checked.body });
  if (status === 201) return { ok: true, document: data };
  return problem(status, data, "The document couldn't be saved. Please try again in a moment.");
}

// A new document. With a meeting chosen, it's shared with that meeting's people straight away.
export async function createDocument(previousState, formData) {
  const result = await addDocument(formData);
  if (!result.ok) return result;
  const meeting = String(formData.get("meeting") ?? "");
  if (isRowId(meeting)) {
    const shared = await staffRequest(`/workspace/documents/${result.document.id}/shares/`,
      { method: "POST", body: { add: [{ kind: "meeting", meeting: Number(meeting) }] } });
    // If sharing failed, say so on the document's page, where it can be shared again.
    if (shared.status !== 200) redirect(`/dashboard/documents/${result.document.id}?share_failed=1`);
    redirect(`/dashboard/meetings/${meeting}?shared=1`);
  }
  redirect(`/dashboard/documents/${result.document.id}?added=1`);
}

export async function shareDocument(id, { add = [], remove = [] }) {
  if (!isRowId(id)) return { error: "This document couldn't be found." };
  const body = {
    add: (Array.isArray(add) ? add : []).map(cleanTarget).filter(Boolean).slice(0, 20),
    remove: (Array.isArray(remove) ? remove : []).filter(isRowId).map(Number),
  };
  const { status, data } = await staffRequest(`/workspace/documents/${id}/shares/`, { method: "POST", body });
  if (status === 200) return { ok: true };
  return problem(status, data, "Sharing couldn't be changed. Please try again in a moment.");
}

export async function shareOptions() {
  const { status, data } = await staffRequest("/workspace/documents/share-options/");
  if (status === 200) return { ok: true, options: data };
  return problem(status, data, "Sharing choices couldn't be loaded just now.");
}

export async function newVersion(id, previousState, formData) {
  if (!isRowId(id)) return { error: "This document couldn't be found." };
  const note = String(formData.get("note") ?? "").trim().slice(0, 300);
  let request;
  if (formData.get("mode") === "text") {
    const text = String(formData.get("text") ?? "");
    if (!text.trim()) return { error: "Please write the words of the document." };
    if (text.length > MAX_TEXT) return { error: "This is too long for one document. Please split it into parts." };
    request = { method: "POST", body: { text, note } };
  } else {
    const file = formData.get("file");
    if (!file || typeof file === "string" || file.size === 0) return { error: "Please choose the new file." };
    if (file.size > MAX_UPLOAD) return { error: "This file is too large. Files can be up to 4 MB." };
    const data = new FormData();
    data.append("file", file, file.name);
    data.append("note", note);
    request = { method: "POST", formData: data };
  }
  const { status, data } = await staffRequest(`/workspace/documents/${id}/versions/`, request);
  if (status === 200) redirect(`/dashboard/documents/${id}?saved=1`);
  return problem(status, data, "The new version couldn't be saved. Please try again in a moment.");
}

export async function restoreVersion(id, number) {
  if (!isRowId(id) || !isRowId(number)) return { error: "This version couldn't be found." };
  const { status, data } = await staffRequest(`/workspace/documents/${id}/restore/`,
    { method: "POST", body: { version: Number(number) } });
  if (status === 200) return { ok: true };
  return problem(status, data, "That version couldn't be brought back. Please try again in a moment.");
}

export async function renameDocument(id, previousState, formData) {
  if (!isRowId(id)) return { error: "This document couldn't be found." };
  const title = String(formData.get("title") ?? "").trim().slice(0, 200);
  if (!title) return { error: "Please give the document a name." };
  const description = String(formData.get("description") ?? "").trim().slice(0, 1000);
  const { status, data } = await staffRequest(`/workspace/documents/${id}/`,
    { method: "PATCH", body: { title, description } });
  if (status === 200) return { ok: true };
  return problem(status, data, "The changes couldn't be saved. Please try again in a moment.");
}

export async function deleteDocument(id) {
  if (!isRowId(id)) return { error: "This document couldn't be found." };
  const { status, data } = await staffRequest(`/workspace/documents/${id}/`, { method: "DELETE" });
  if (status === 204) redirect("/dashboard/documents?view=mine&deleted=1");
  return problem(status, data, "The document couldn't be deleted. Please try again in a moment.");
}

// Handing in a deliverable with its file: the file becomes the person's document,
// shared with the meeting's people by the API.
export async function handInWithFile(deliverableId, title, formData) {
  if (!isRowId(deliverableId)) return { error: "This deliverable couldn't be found." };
  const note = String(formData.get("note") ?? "").slice(0, 1000);
  const file = formData.get("file");
  let document = null;
  if (file && typeof file !== "string" && file.size > 0) {
    const upload = new FormData();
    upload.append("mode", "file");
    upload.append("title", String(title ?? "").slice(0, 200) || "Deliverable");
    upload.append("file", file, file.name);
    const added = await addDocument(upload);
    if (!added.ok) return added;
    document = added.document.id;
  }
  const { status, data } = await staffRequest(`/workspace/deliverables/${deliverableId}/submit/`,
    { method: "POST", body: { note, ...(document && { document }) } });
  if (status === 200) return { ok: true };
  return problem(status, data, "This couldn't be handed in. Please try again in a moment.");
}
