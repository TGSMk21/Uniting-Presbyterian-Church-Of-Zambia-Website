"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import AttendeeChooser from "./attendee-chooser";
import { createMeeting, updateMeeting } from "@/app/dashboard/workspace-actions";
import { formValues, parsePlace } from "@/Utilities/meetings.mjs";
import { templateFor } from "@/Utilities/deliverables.mjs";

// Planning a meeting, or changing one (Task 8.3). Kept to what a clerk needs: what, who
// it's for, when, where and who's invited. The agenda is optional.
export default function MeetingForm({ places, templates = [], meeting = null, defaultDate = "" }) {
  const editing = Boolean(meeting);
  const [state, action, pending] = useActionState(editing ? updateMeeting.bind(null, meeting.id) : createMeeting, {});
  const [place, setPlace] = useState(places[0]?.value ?? "");
  const [chosen, setChosen] = useState([]);
  const [template, setTemplate] = useState(() => String(templateFor(templates, places[0]?.value)?.id ?? ""));
  const level = parsePlace(place)?.level;
  const choices = templates.filter((t) => t.level === level);
  const picked = choices.find((t) => String(t.id) === template);
  const choosePlace = (value) => {
    setPlace(value);
    setChosen([]);
    setTemplate(String(templateFor(templates, value)?.id ?? ""));
  };
  const when = editing ? formValues(meeting) : { date: defaultDate, start: "", end: "" };

  return (
    <form action={action} className="dash-form ws-meeting-form">
      <label className="dash-field">
        <span>What is the meeting?</span>
        <input name="title" type="text" required maxLength={200} defaultValue={meeting?.title}
          placeholder="e.g. Session meeting" />
      </label>

      {!editing && (
        places.length > 1 ? (
          <label className="dash-field">
            <span>Who is it for?</span>
            <select name="place" value={place} onChange={(event) => choosePlace(event.target.value)}>
              {places.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
        ) : (
          <input type="hidden" name="place" value={place} />
        )
      )}

      <div className="ws-when">
        <label className="dash-field">
          <span>Date</span>
          <input name="date" type="date" required defaultValue={when.date} />
        </label>
        <label className="dash-field">
          <span>Starts</span>
          <input name="start" type="time" required defaultValue={when.start} />
        </label>
        <label className="dash-field">
          <span>Ends <span className="dash-optional">optional</span></span>
          <input name="end" type="time" defaultValue={when.end} />
        </label>
      </div>

      <label className="dash-field">
        <span>Where <span className="dash-optional">optional</span></span>
        <input name="venue" type="text" maxLength={200} defaultValue={meeting?.venue} placeholder="e.g. Church hall" />
      </label>
      <label className="dash-field">
        <span>Video call link <span className="dash-optional">optional</span></span>
        <input name="online_link" type="url" maxLength={200} defaultValue={meeting?.online_link}
          placeholder="https://" inputMode="url" />
      </label>
      <label className="dash-field">
        <span>Agenda <span className="dash-optional">optional</span></span>
        <textarea name="agenda" rows={5} maxLength={4000} defaultValue={meeting?.agenda}
          placeholder={"1. Opening prayer\n2. Minutes of the last meeting"} />
      </label>

      {!editing && (
        <fieldset className="ws-fieldset">
          <legend>Who should attend?</legend>
          <p className="dash-help">You&apos;re added automatically. Everyone you invite is told straight away.</p>
          <AttendeeChooser place={place} chosen={chosen} onChange={setChosen} />
          <input type="hidden" name="attendees" value={JSON.stringify(chosen.map((p) => p.id))} />
        </fieldset>
      )}

      {!editing && choices.length > 0 && (
        <fieldset className="ws-fieldset">
          <legend>What should people bring?</legend>
          <label className="dash-field">
            <span className="sr-only">Checklist</span>
            <select name="template" value={template} onChange={(event) => setTemplate(event.target.value)}>
              {choices.map((t) => <option key={t.id} value={t.id}>The usual for a {t.name.toLowerCase()}</option>)}
              <option value="">Nothing for now</option>
            </select>
          </label>
          {picked && (
            <ul className="ws-checklist-preview">
              {picked.items.map((item) => (
                <li key={item.title}>
                  <span>{item.title}</span>
                  <span className="ws-muted">{item.who} · {item.days_before} {item.days_before === 1 ? "day" : "days"} before</span>
                </li>
              ))}
            </ul>
          )}
          <p className="dash-help">Each person is told what to prepare and when it&apos;s due. You can change any of it later.</p>
        </fieldset>
      )}

      {state.error && <p className="dash-error" role="alert">{state.error}</p>}
      <div className="ws-form-actions">
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? "Saving…" : editing ? "Save changes" : chosen.length ? `Plan it and tell ${chosen.length}` : "Plan it"}
        </button>
        <Link href={editing ? `/dashboard/meetings/${meeting.id}` : "/dashboard/meetings"} className="btn-ghost">Cancel</Link>
      </div>
      {editing && <p className="dash-help">If you change the time or place, everyone invited is told.</p>}
    </form>
  );
}
