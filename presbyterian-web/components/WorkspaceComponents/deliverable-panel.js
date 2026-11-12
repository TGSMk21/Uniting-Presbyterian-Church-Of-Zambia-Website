"use client";

import { useActionState, useEffect, useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, X } from "lucide-react";
import { useConfirm } from "@/components/DashboardComponents/confirm-dialog";
import Link from "next/link";
import { addDeliverable, applyChecklist, changeDeliverable, handInWithFile, removeDeliverable, reviewDeliverable }
  from "@/app/dashboard/workspace-actions";
import { deliverableState, dueText } from "@/Utilities/deliverables.mjs";

function useRun() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState(null);
  const run = (work, after) => start(async () => {
    const result = await work();
    if (result?.signedOut) return window.location.assign("/dashboard/login");
    setError(result?.error ?? null);
    if (result?.ok) {
      after?.();
      router.refresh();
    }
  });
  return { pending, error, run };
}

// A short note box that opens in place: "Hand it in" and "Send back" both use it.
function NoteStep({ label, required = false, placeholder, confirmLabel, pending, onConfirm, onCancel }) {
  const [note, setNote] = useState("");
  const id = useId();
  return (
    <div className="ws-note-step">
      <label className="dash-field" htmlFor={id}>
        <span>{label} {!required && <span className="dash-optional">optional</span>}</span>
        <textarea id={id} rows={2} maxLength={1000} value={note} placeholder={placeholder} autoFocus
          onChange={(event) => setNote(event.target.value)} />
      </label>
      <div className="ws-actions">
        <button type="button" className="btn-primary" disabled={pending || (required && !note.trim())}
          onClick={() => onConfirm(note)}>{pending ? "Saving…" : confirmLabel}</button>
        <button type="button" className="btn-ghost" onClick={onCancel}>Back</button>
      </div>
    </div>
  );
}

// Handing it in: attach the file (it's shared with the meeting's people) and add a note.
function HandInStep({ pending, onSubmit, onCancel }) {
  const submit = (event) => {
    event.preventDefault();
    onSubmit(new FormData(event.currentTarget));
  };
  return (
    <form className="ws-note-step" onSubmit={submit}>
      <label className="dash-field">
        <span>The file <span className="dash-optional">optional</span></span>
        <input name="file" type="file" accept=".pdf,.docx,.xlsx,.pptx,.txt,.jpg,.jpeg,.png,.webp,application/pdf,image/*" />
        <span className="dash-help">It&apos;s shared with the people at this meeting.</span>
      </label>
      <label className="dash-field">
        <span>A note for the organiser <span className="dash-optional">optional</span></span>
        <textarea name="note" rows={2} maxLength={1000} placeholder="e.g. Printed copies will be at the meeting" />
      </label>
      <div className="ws-actions">
        <button type="submit" className="btn-primary" disabled={pending}>{pending ? "Handing in…" : "Hand it in"}</button>
        <button type="button" className="btn-ghost" onClick={onCancel}>Back</button>
      </div>
    </form>
  );
}

function Row({ row, meeting }) {
  const { pending, error, run } = useRun();
  const [confirm, dialog] = useConfirm();
  const [step, setStep] = useState(null);
  const state = deliverableState(row);
  const open = row.status === "todo" || row.status === "changes";
  const manage = meeting.can_manage && meeting.status !== "cancelled";

  const remove = async () => {
    const yes = await confirm({ title: `Remove “${row.title}”?`, message: "It comes off this meeting's list.",
      confirmLabel: "Remove", danger: true });
    if (yes) run(() => removeDeliverable(row.id));
  };

  return (
    <li className="ws-deliverable">
      <div className="ws-deliverable-main">
        <span className="ws-deliverable-title">{row.title}</span>
        <span className="ws-person-meta">
          {row.assignee ? (row.is_mine ? "You" : row.assignee.name) : "Nobody chosen yet"} · due {dueText(row.due_on)}
        </span>
        {row.notes && <span className="ws-deliverable-note">{row.notes}</span>}
        {row.document && (
          <Link href={`/dashboard/documents/${row.document.id}`} className="dash-link ws-deliverable-doc">
            {row.document.title}
          </Link>
        )}
        {row.submitted_note && row.status !== "todo" && (
          <span className="ws-deliverable-note">Note when handed in: {row.submitted_note}</span>
        )}
        {row.status === "changes" && row.review_note && (
          <span className="ws-deliverable-note ws-deliverable-back">Sent back: {row.review_note}</span>
        )}
      </div>
      <span className={`dash-badge ${state.tone === "danger" ? "ws-badge-danger" : `dash-badge-${state.tone}`}`}>{state.label}</span>
      {manage && (
        <span className="ws-row-tools">
          {open && (
            <button type="button" className="ws-icon-button ws-icon-quiet" aria-label={`Change who or when for ${row.title}`}
              title="Change person or date" onClick={() => setStep(step === "change" ? null : "change")}>
              <Pencil size={15} aria-hidden="true" />
            </button>
          )}
          <button type="button" className="ws-icon-button" aria-label={`Remove ${row.title}`} title="Remove"
            onClick={remove} disabled={pending}>
            <X size={16} aria-hidden="true" />
          </button>
        </span>
      )}

      {step === null && (
        <div className="ws-actions ws-deliverable-actions">
          {row.is_mine && open && (
            <button type="button" className="btn-primary" onClick={() => setStep("hand-in")}>Hand it in</button>
          )}
          {manage && !row.is_mine && row.status === "submitted" && (
            <>
              <button type="button" className="btn-primary" disabled={pending}
                onClick={() => run(() => reviewDeliverable(row.id, "accept"))}>Accept</button>
              <button type="button" className="btn-ghost" onClick={() => setStep("send-back")}>Send back</button>
            </>
          )}
        </div>
      )}
      {step === "hand-in" && (
        <HandInStep row={row} meeting={meeting} pending={pending} onCancel={() => setStep(null)}
          onSubmit={(formData) => run(() => handInWithFile(row.id, `${row.title}, ${meeting.title}`, formData),
            () => setStep(null))} />
      )}
      {step === "send-back" && (
        <NoteStep label="What needs changing?" required placeholder="e.g. Please add October's figures"
          confirmLabel="Send back" pending={pending} onCancel={() => setStep(null)}
          onConfirm={(note) => run(() => reviewDeliverable(row.id, "changes", note), () => setStep(null))} />
      )}
      {step === "change" && (
        <ChangeStep row={row} meeting={meeting} pending={pending} onCancel={() => setStep(null)}
          onSave={(values) => run(() => changeDeliverable(row.id, values), () => setStep(null))} />
      )}
      {error && <p className="dash-error ws-deliverable-error" role="alert">{error}</p>}
      {dialog}
    </li>
  );
}

function PersonSelect({ meeting, name, defaultValue = "" }) {
  return (
    <select name={name} defaultValue={defaultValue}>
      <option value="">Nobody yet</option>
      {meeting.attendees.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
    </select>
  );
}

function ChangeStep({ row, meeting, pending, onSave, onCancel }) {
  const save = (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const person = String(data.get("assignee") ?? "");
    onSave({ assignee: person ? Number(person) : null, due_on: String(data.get("due_on") ?? "") });
  };
  return (
    <form className="ws-note-step ws-change-step" onSubmit={save}>
      <label className="dash-field"><span>Who prepares it</span>
        <PersonSelect meeting={meeting} name="assignee" defaultValue={row.assignee?.id ?? ""} />
      </label>
      <label className="dash-field"><span>Due</span>
        <input name="due_on" type="date" required defaultValue={row.due_on} />
      </label>
      <div className="ws-actions">
        <button type="submit" className="btn-primary" disabled={pending}>{pending ? "Saving…" : "Save"}</button>
        <button type="button" className="btn-ghost" onClick={onCancel}>Back</button>
      </div>
      <p className="dash-help">Only people invited to the meeting are listed. Invite someone first to give them work.</p>
    </form>
  );
}

function AddForm({ meeting, onDone }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(addDeliverable.bind(null, meeting.id), {});
  useEffect(() => {
    if (state.ok) {
      onDone();
      router.refresh();
    }
  }, [state, onDone, router]);
  return (
    <form action={action} className="ws-note-step">
      <label className="dash-field"><span>What should be brought?</span>
        <input name="title" type="text" required maxLength={200} placeholder="e.g. Building fund report" autoFocus />
      </label>
      <div className="ws-when ws-when-two">
        <label className="dash-field"><span>Who prepares it</span><PersonSelect meeting={meeting} name="assignee" /></label>
        <label className="dash-field"><span>Due</span><input name="due_on" type="date" required /></label>
      </div>
      <label className="dash-field"><span>Notes <span className="dash-optional">optional</span></span>
        <textarea name="notes" rows={2} maxLength={1000} />
      </label>
      {state.error && <p className="dash-error" role="alert">{state.error}</p>}
      <div className="ws-actions">
        <button type="submit" className="btn-primary" disabled={pending}>{pending ? "Adding…" : "Add"}</button>
        <button type="button" className="btn-ghost" onClick={onDone}>Back</button>
      </div>
    </form>
  );
}

// What people must bring to this meeting, and how far along each is (R4).
export default function DeliverablePanel({ meeting, templates = [] }) {
  const { pending, error, run } = useRun();
  const [adding, setAdding] = useState(false);
  const rows = meeting.deliverables;
  const manage = meeting.can_manage && meeting.status !== "cancelled";
  const done = rows.filter((row) => row.status === "accepted").length;
  if (!rows.length && !manage) return null;

  return (
    <section className="ws-panel ws-deliverables" aria-labelledby="ws-deliverables">
      <h2 id="ws-deliverables" className="dash-subheading">To bring</h2>
      {rows.length > 0 && (
        <p className="ws-counts">{done} of {rows.length} accepted
          {rows.some((r) => r.overdue) && <> · <span className="ws-overdue">{rows.filter((r) => r.overdue).length} overdue</span></>}
        </p>
      )}
      {rows.length > 0 ? (
        <ul className="ws-people">{rows.map((row) => <Row key={row.id} row={row} meeting={meeting} />)}</ul>
      ) : (
        <p className="dash-help">Nothing to bring yet.</p>
      )}

      {manage && !adding && (
        <div className="ws-actions">
          {rows.length === 0 && templates.map((t) => (
            <button key={t.id} type="button" className="btn-primary" disabled={pending}
              onClick={() => run(() => applyChecklist(meeting.id, t.id))}>
              Use the usual {t.name.toLowerCase()} list
            </button>
          ))}
          <button type="button" className="btn-ghost" onClick={() => setAdding(true)}>Add something to bring</button>
        </div>
      )}
      {manage && adding && <AddForm meeting={meeting} onDone={() => setAdding(false)} />}
      {error && <p className="dash-error" role="alert">{error}</p>}
    </section>
  );
}
