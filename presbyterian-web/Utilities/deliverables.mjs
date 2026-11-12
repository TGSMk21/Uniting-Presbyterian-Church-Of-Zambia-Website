// Deliverables and meeting checklists (AGENT_EXECUTION_PLAN.md, Task 8.4): plain helpers
// for the pages, and the workspace's lines on the Overview (Task 8.2).
import { isRowId } from "./workspace.mjs";
import { meetingWhen, parsePlace } from "./meetings.mjs";

export const STATUS = { todo: "To do", submitted: "Handed in", accepted: "Accepted", changes: "Needs changes" };
const TONE = { todo: "neutral", submitted: "warning", accepted: "success", changes: "danger" };

export function deliverableState(row) {
  if (row.overdue) return { label: "Overdue", tone: "danger" };
  return { label: STATUS[row.status] ?? "", tone: TONE[row.status] ?? "neutral" };
}

export function dueText(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date ?? ""))) return "";
  return new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" })
    .format(new Date(`${date}T12:00:00Z`)).replace(",", "");
}

export function deliverableFromForm(formData, meeting) {
  if (!isRowId(meeting)) return { error: "This meeting couldn't be found." };
  const title = String(formData.get("title") ?? "").trim().slice(0, 200);
  if (!title) return { error: "Please say what needs to be brought." };
  const dueOn = String(formData.get("due_on") ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueOn)) return { error: "Please choose the date it's due." };
  const assignee = String(formData.get("assignee") ?? "");
  if (assignee && !isRowId(assignee)) return { error: "Please choose the person from the list." };
  return {
    body: { meeting: Number(meeting), title, assignee: assignee ? Number(assignee) : null, due_on: dueOn,
      notes: String(formData.get("notes") ?? "").trim().slice(0, 1000) },
  };
}

// The checklist offered first when planning: the usual one for that kind of meeting.
export function templateFor(templates, placeValue) {
  const level = parsePlace(placeValue)?.level;
  return (level && (templates || []).find((t) => t.level === level)) || null;
}

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

export function workspaceAttention(attention) {
  if (!attention) return [];
  const link = (row) => `/dashboard/meetings/${row.meeting.id}`;
  const late = (attention.deliverables || []).filter((d) => d.overdue);
  const due = (attention.deliverables || []).filter((d) => !d.overdue);
  return [
    ...late.map((d) => ({ text: `${d.title} for ${d.meeting.title} was due ${dueText(d.due_on)}`, href: link(d), tone: "danger" })),
    ...(attention.to_review ? [{ text: `${plural(attention.to_review, "deliverable", "deliverables")} handed in for you to check`,
      href: "/dashboard/deliverables?view=review", tone: "warning" }] : []),
    ...(attention.answer_needed ? [{ text: `${plural(attention.answer_needed, "meeting invitation", "meeting invitations")} to answer`,
      href: "/dashboard/meetings", tone: "warning" }] : []),
    ...due.map((d) => ({ text: `${d.title} for ${d.meeting.title} is due ${dueText(d.due_on)}`, href: link(d), tone: "neutral" })),
    ...(attention.meetings || []).map((m) => ({ text: `${m.title}, ${meetingWhen(m)}`, href: `/dashboard/meetings/${m.id}`, tone: "info" })),
  ];
}
