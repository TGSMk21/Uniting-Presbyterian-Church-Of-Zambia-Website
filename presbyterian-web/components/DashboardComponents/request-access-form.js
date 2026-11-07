"use client";

import { useActionState } from "react";
import { requestAccess } from "@/app/dashboard/access-actions";
import { KINDS, REQUEST_LIMITS } from "@/Utilities/accessRequests.mjs";

function Field({ label, help, error, optional, children }) {
  return (
    <label className="dash-field">
      <span>{label}{optional && <span className="dash-optional"> (optional)</span>}</span>
      {children}
      {help && <small>{help}</small>}
      {error && <span className="dash-field-error" role="alert">{error}</span>}
    </label>
  );
}

export default function RequestAccessForm({ branches }) {
  const [state, action, pending] = useActionState(requestAccess, { sent: false, error: null, fields: {}, values: null });

  if (state.sent) {
    return (
      <div className="dash-notice" role="status">
        Thank you. Your request has been sent. When it&apos;s approved, you&apos;ll receive a link to choose your password,
        usually by WhatsApp or SMS.
      </div>
    );
  }

  const shown = state.values || {};
  const invalid = (key) => (state.fields[key] ? true : undefined);
  // The keys put typed values back after React clears the form.
  const box = (key, props) => (
    <input key={shown[key] ?? ""} name={key} defaultValue={shown[key] ?? ""} aria-invalid={invalid(key)} {...props} />
  );

  return (
    <form action={action} className="dash-form" noValidate>
      <Field label="Full name" error={state.fields.full_name}>
        {box("full_name", { type: "text", required: true, maxLength: REQUEST_LIMITS.full_name, autoComplete: "name" })}
      </Field>
      <Field label="Email" error={state.fields.email}>
        {box("email", { type: "email", required: true, maxLength: REQUEST_LIMITS.email, autoComplete: "email" })}
      </Field>
      <Field label="Phone" help="Your link may be sent here by WhatsApp or SMS." error={state.fields.phone}>
        {box("phone", { type: "tel", required: true, maxLength: REQUEST_LIMITS.phone, autoComplete: "tel" })}
      </Field>
      <Field label="Branch" error={state.fields.branch}>
        <select key={shown.branch ?? ""} name="branch" defaultValue={shown.branch ?? ""} required aria-invalid={invalid("branch")}>
          <option value="">Choose your branch</option>
          {branches.map(({ slug, name }) => <option key={slug} value={slug}>{name}</option>)}
        </select>
      </Field>
      <fieldset className="dash-choice">
        <legend>Your role</legend>
        {KINDS.map(({ value, label }) => (
          <label key={value} className="dash-check">
            <input type="radio" name="kind" value={value} defaultChecked={(shown.kind || "minister") === value} />
            <span>{label}</span>
          </label>
        ))}
        {state.fields.kind && <span className="dash-field-error" role="alert">{state.fields.kind}</span>}
      </fieldset>
      <Field label="Anything we should know" optional error={state.fields.note}>
        <textarea key={shown.note ?? ""} name="note" rows={3} maxLength={REQUEST_LIMITS.note} defaultValue={shown.note ?? ""} />
      </Field>
      {/* Hidden from people; robots fill it in. */}
      <div className="dash-hidden" aria-hidden="true">
        <label>Website <input name="website" type="text" tabIndex={-1} autoComplete="off" /></label>
      </div>
      <p className="dash-error" role="alert">{state.error}</p>
      <button type="submit" className="btn-primary dash-submit" disabled={pending}>
        {pending ? "Sending…" : "Send request"}
      </button>
    </form>
  );
}
