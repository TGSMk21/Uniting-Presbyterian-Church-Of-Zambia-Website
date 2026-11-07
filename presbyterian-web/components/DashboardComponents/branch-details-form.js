"use client";

import { useActionState, useState } from "react";
import { saveBranchDetails } from "@/app/dashboard/content-actions";
import { parsePosition } from "@/Utilities/branchDetails.mjs";
import PositionMap from "./position-map";

function Field({ label, help, error, optional = true, children }) {
  return (
    <label className="dash-field">
      <span>{label}{optional && <span className="dash-optional"> (optional)</span>}</span>
      {children}
      {help && <small>{help}</small>}
      {error && <span className="dash-field-error" role="alert">{error}</span>}
    </label>
  );
}

export default function BranchDetailsForm({ branch, values, positionText, viewHref }) {
  const [state, action, pending] = useActionState(saveBranchDetails.bind(null, branch), {
    saved: false,
    error: null,
    fields: {},
    values: null,
  });
  // The position box is kept by React, so it survives the form being cleared after saving.
  const [position, setPosition] = useState(positionText);
  const parsed = parsePosition(position);
  const shown = state.values || values;
  const hasErrors = state.error || Object.keys(state.fields).length > 0;
  const invalid = (key) => (state.fields[key] ? true : undefined);

  function pick({ latitude, longitude }) {
    setPosition(`${latitude}, ${longitude}`);
  }

  return (
    <form action={action} className="dash-editor">
      <fieldset className="dash-section">
        <legend>Contact details</legend>
        <Field
          label="Email"
          help="Messages from your Contact page go here. Leave empty to send them to the national office."
          error={state.fields.contact_email}
        >
          <input key={shown.contact_email} type="email" name="contact_email" defaultValue={shown.contact_email}
            maxLength={254} aria-invalid={invalid("contact_email")} />
        </Field>
        <Field label="Phone" error={state.fields.contact_phone}>
          <input key={shown.contact_phone} type="tel" name="contact_phone" defaultValue={shown.contact_phone}
            maxLength={20} aria-invalid={invalid("contact_phone")} />
        </Field>
        <Field
          label="Address"
          help="Put the town second to last, like Plot 12, Freedom Compound, Chilanga, Lusaka, Zambia. Find a Branch sorts branches by that town."
          error={state.fields.address}
        >
          <textarea key={shown.address} name="address" rows={3} defaultValue={shown.address} maxLength={500}
            aria-invalid={invalid("address")} />
        </Field>
      </fieldset>

      <fieldset className="dash-section">
        <legend>Map position</legend>
        <p className="dash-text">
          Click the map where the church building is. Zoom in with the + button to place it exactly. You can also
          paste the position from Google Maps: right-click the church there and click the numbers at the top.
        </p>
        <PositionMap position={parsed.position ?? null} onPick={pick} />
        <Field label="Position" error={state.fields.position || parsed.error}>
          <input type="text" name="position" value={position} onChange={(event) => setPosition(event.target.value)}
            inputMode="decimal" placeholder="-15.4167, 28.2833" autoComplete="off"
            aria-invalid={state.fields.position || parsed.error ? true : undefined} />
        </Field>
        {position && (
          <button type="button" className="dash-quiet-button dash-align-start" onClick={() => setPosition("")}>
            Clear the position
          </button>
        )}
        <label className="dash-check">
          <input key={String(shown.location_confirmed)} type="checkbox" name="location_confirmed"
            defaultChecked={shown.location_confirmed} />
          <span>The pin is on the church building itself</span>
        </label>
        <small className="dash-help">
          Leave this unticked if the pin only marks the area. Find a Branch then says &ldquo;Approximate area&rdquo;
          and gives directions by address instead.
        </small>
        {state.fields.location_confirmed && (
          <span className="dash-field-error" role="alert">{state.fields.location_confirmed}</span>
        )}
      </fieldset>

      <div className="dash-savebar">
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? "Saving…" : "Save changes"}
        </button>
        <p className="dash-savebar-status" role="status">
          {pending ? "" : state.saved && !hasErrors ? (
            <>
              Saved. <a href={viewHref} target="_blank" rel="noopener">See it in Find a Branch</a>
            </>
          ) : (
            hasErrors && (
              <span className="dash-error">{state.error || "Nothing was saved. Please fix the boxes marked in red."}</span>
            )
          )}
        </p>
      </div>
    </form>
  );
}
