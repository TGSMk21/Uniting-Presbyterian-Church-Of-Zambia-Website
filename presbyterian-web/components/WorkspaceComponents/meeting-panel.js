"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, X } from "lucide-react";
import AttendeeChooser from "./attendee-chooser";
import { useConfirm } from "@/components/DashboardComponents/confirm-dialog";
import { cancelMeeting, changeAttendees, copyMeeting, recordAttendance, respondToMeeting }
  from "@/app/dashboard/workspace-actions";
import { RESPONSES, attendeeCounts } from "@/Utilities/meetings.mjs";

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

// "Will you be there?" for the signed-in attendee.
export function MyAnswer({ meeting }) {
  const { pending, error, run } = useRun();
  const answer = meeting.my_response;
  return (
    <div className="ws-answer" role="group" aria-label="Will you be there?">
      <p className="ws-answer-q">{answer === "pending" ? "Will you be there?" : "Your answer"}</p>
      <div className="ws-answer-buttons">
        <button type="button" aria-pressed={answer === "attending"} disabled={pending}
          onClick={() => run(() => respondToMeeting(meeting.id, "attending"))}>
          <Check size={16} aria-hidden="true" /> Attending
        </button>
        <button type="button" aria-pressed={answer === "apologies"} disabled={pending}
          onClick={() => run(() => respondToMeeting(meeting.id, "apologies"))}>
          <X size={16} aria-hidden="true" /> Sending apologies
        </button>
      </div>
      {error && <p className="dash-error" role="alert">{error}</p>}
    </div>
  );
}

// Changing, copying and cancelling, for the meeting's organisers.
export function ManageMeeting({ meeting }) {
  const { pending, error, run } = useRun();
  const [confirm, dialog] = useConfirm();
  const [copyState, copyAction, copying] = useActionState(copyMeeting.bind(null, meeting.id), {});
  const [planning, setPlanning] = useState(false);

  const cancel = async () => {
    const yes = await confirm({
      title: "Cancel this meeting?",
      message: "Everyone invited is told it's cancelled. It stays on the calendar, marked cancelled.",
      confirmLabel: "Cancel the meeting", danger: true,
    });
    if (yes) run(() => cancelMeeting(meeting.id));
  };

  return (
    <div className="ws-manage">
      <div className="ws-actions">
        {meeting.status === "scheduled" && <Link href={`/dashboard/meetings/${meeting.id}/edit`} className="btn-ghost">Change details</Link>}
        <button type="button" className="btn-ghost" onClick={() => setPlanning((open) => !open)} aria-expanded={planning}>
          Plan the next one
        </button>
        {meeting.status === "scheduled" && (
          <button type="button" className="dash-danger-button" onClick={cancel} disabled={pending}>Cancel meeting</button>
        )}
      </div>
      {planning && (
        <form action={copyAction} className="ws-copy">
          <p className="dash-help">Same name, place, agenda and people, on a new date. Everyone is invited again.</p>
          <div className="ws-when">
            <label className="dash-field"><span>New date</span><input name="date" type="date" required /></label>
            <label className="dash-field"><span>Starts</span><input name="start" type="time" required /></label>
          </div>
          {copyState.error && <p className="dash-error" role="alert">{copyState.error}</p>}
          <button type="submit" className="btn-primary" disabled={copying}>{copying ? "Planning…" : "Plan it"}</button>
        </form>
      )}
      {error && <p className="dash-error" role="alert">{error}</p>}
      {dialog}
    </div>
  );
}

const BADGE = { attending: "dash-badge-success", apologies: "dash-badge-warning", pending: "dash-badge-neutral" };

// Who's invited and how they answered; organisers invite more, remove people and,
// once the meeting has started, record who came.
export function Attendees({ meeting, place }) {
  const { pending, error, run } = useRun();
  const [confirm, dialog] = useConfirm();
  const [mode, setMode] = useState(null);
  const [chosen, setChosen] = useState([]);
  const [present, setPresent] = useState(() => new Set(meeting.attendees.filter((a) => a.present).map((a) => a.id)));
  const counts = attendeeCounts(meeting.attendees);
  const manage = meeting.can_manage && meeting.status !== "cancelled";
  const recorded = meeting.attendees.some((a) => a.present !== null);

  const remove = async (person) => {
    if (await confirm({ title: `Remove ${person.name}?`, message: "They won't be told.", confirmLabel: "Remove" })) {
      run(() => changeAttendees(meeting.id, { remove: [person.id] }));
    }
  };
  const toggle = (id) => setPresent((was) => {
    const next = new Set(was);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  return (
    <section className="ws-panel ws-attendees" aria-labelledby="ws-who">
      <h2 id="ws-who" className="dash-subheading">{recorded ? "Who came" : "Who\u2019s coming"}</h2>
      <p className="ws-counts">
        {recorded
          ? `Came ${meeting.attendees.filter((a) => a.present).length} of ${meeting.attendees.length}`
          : `Attending ${counts.attending} · Apologies ${counts.apologies} · No reply ${counts.pending}`}
      </p>

      {mode === "attendance" ? (
        <>
          <p className="dash-help">Tick everyone who came.</p>
          <ul className="ws-people">
            {meeting.attendees.map((person) => (
              <li key={person.id}>
                <label className="dash-check">
                  <input type="checkbox" checked={present.has(person.id)} onChange={() => toggle(person.id)} />
                  <span>{person.name}</span>
                </label>
              </li>
            ))}
          </ul>
          <div className="ws-actions">
            <button type="button" className="btn-primary" disabled={pending}
              onClick={() => run(() => recordAttendance(meeting.id, [...present]), () => setMode(null))}>
              {pending ? "Saving…" : "Save attendance"}
            </button>
            <button type="button" className="btn-ghost" onClick={() => setMode(null)}>Back</button>
          </div>
        </>
      ) : (
        <ul className="ws-people">
          {meeting.attendees.map((person) => (
            <li key={person.id}>
              <span className="ws-person">
                <span className="ws-person-name">{person.name}</span>
                {person.branch && <span className="ws-person-meta">{person.branch.name}</span>}
              </span>
              {recorded ? (
                <span className={`dash-badge ${person.present ? "dash-badge-success" : "dash-badge-neutral"}`}>
                  {person.present ? "Came" : "Absent"}
                </span>
              ) : (
                <span className={`dash-badge ${BADGE[person.response]}`}>{RESPONSES[person.response]}</span>
              )}
              {manage && mode === null && person.id !== meeting.organiser?.id && (
                <button type="button" className="ws-icon-button" aria-label={`Remove ${person.name}`}
                  onClick={() => remove(person)} disabled={pending}>
                  <X size={16} aria-hidden="true" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {mode === "invite" && (
        <div className="ws-invite-more">
          <AttendeeChooser place={place} chosen={chosen} onChange={setChosen} fixed={meeting.attendees.map((a) => a.id)} />
          <div className="ws-actions">
            <button type="button" className="btn-primary" disabled={pending || chosen.length === 0}
              onClick={() => run(() => changeAttendees(meeting.id, { add: chosen.map((p) => p.id) }),
                () => { setChosen([]); setMode(null); })}>
              {pending ? "Inviting…" : chosen.length ? `Invite ${chosen.length}` : "Invite"}
            </button>
            <button type="button" className="btn-ghost" onClick={() => { setChosen([]); setMode(null); }}>Back</button>
          </div>
        </div>
      )}

      {manage && mode === null && (
        <div className="ws-actions">
          {meeting.status === "scheduled" && (
            <button type="button" className="btn-ghost" onClick={() => setMode("invite")}>Invite more people</button>
          )}
          {meeting.has_started && (
            <button type="button" className={recorded ? "btn-ghost" : "btn-primary"} onClick={() => setMode("attendance")}>
              {recorded ? "Change attendance" : "Record who came"}
            </button>
          )}
        </div>
      )}
      {error && <p className="dash-error" role="alert">{error}</p>}
      {dialog}
    </section>
  );
}
