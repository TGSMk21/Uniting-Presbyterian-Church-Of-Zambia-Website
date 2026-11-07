"use client";

import { useActionState } from "react";
import Link from "next/link";
import { approveRequest, turnDownRequest } from "@/app/dashboard/access-actions";
import { STAFF_ROLES } from "@/Utilities/staffAdmin.mjs";
import { LinkMessage } from "./link-message";

function Field({ label, help, error, children }) {
  return (
    <label className="dash-field">
      <span>{label}</span>
      {children}
      {help && <small>{help}</small>}
      {error && <span className="dash-field-error" role="alert">{error}</span>}
    </label>
  );
}

// The link, shown once after approving (decision D3). It isn't kept anywhere readable.
function Handover({ approved }) {
  return (
    <div className="dash-panel dash-handover" role="status">
      <h2 className="dash-subheading">Account made: {approved.username}</h2>
      <p className="dash-text">
        Send them this message by WhatsApp or SMS. The link works once and stops working after 3 days; it won&apos;t be
        shown again. If it&apos;s lost, make a new one from their page under Staff.
      </p>
      <LinkMessage message={approved.message} />
      <div className="dash-links">
        <Link href="/dashboard/requests" className="dash-link" prefetch={false}>Back to requests</Link>
      </div>
    </div>
  );
}

export function ApproveRequestForm({ id, kind, fullName, superuser, branch, branchName, branches, ministers, username }) {
  const [state, action, pending] = useActionState(approveRequest.bind(null, id, { superuser, kind }), {
    approved: null, error: null, fields: {}, values: null,
  });
  if (state.approved) return <Handover approved={state.approved} />;

  const shown = state.values || {};
  const invalid = (key) => (state.fields[key] ? true : undefined);

  return (
    <form action={action} className="dash-editor">
      <fieldset className="dash-section">
        <legend>Approve</legend>
        <Field label="Username" error={state.fields.username}
          help="What they'll sign in with. Small letters, numbers and . _ - only; it can't be changed later.">
          <input key={shown.username ?? username} name="username" type="text" required maxLength={150}
            defaultValue={shown.username ?? username} autoCapitalize="none" spellCheck={false} aria-invalid={invalid("username")} />
        </Field>
        {superuser && kind === "minister" && (
          <Field label="Their minister profile" error={state.fields.minister}
            help={`Their account will be a Branch Admin of ${branchName}, linked to this profile.`}>
            <select key={shown.minister ?? ""} name="minister" defaultValue={shown.minister ?? (ministers.length ? "" : "new")}
              required aria-invalid={invalid("minister")}>
              {ministers.length > 0 && <option value="">Choose…</option>}
              {ministers.map(({ id: ministerId, name }) => <option key={ministerId} value={String(ministerId)}>{name}</option>)}
              <option value="new">Make a new profile: {fullName}</option>
            </select>
          </Field>
        )}
        {superuser && kind !== "minister" && (
          <>
            <Field label="Role" error={state.fields.role}>
              <select key={shown.role ?? ""} name="role" defaultValue={shown.role || "content_editor"} aria-invalid={invalid("role")}>
                {STAFF_ROLES.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
              </select>
            </Field>
            <Field label="Branch" error={state.fields.branch}>
              <select key={shown.branch ?? ""} name="branch" defaultValue={shown.branch || branch} aria-invalid={invalid("branch")}>
                {branches.map(({ slug, name }) => <option key={slug} value={slug}>{name}</option>)}
              </select>
            </Field>
          </>
        )}
        {!superuser && <p className="dash-text">They&apos;ll be a content editor for {branchName}.</p>}
      </fieldset>
      <div className="dash-savebar">
        <button type="submit" className="btn-primary" disabled={pending}>{pending ? "Approving…" : "Approve and make the link"}</button>
        <p className="dash-savebar-status" role="status">
          {!pending && (state.error || Object.keys(state.fields).length > 0) && (
            <span className="dash-error">{state.error || "Nothing was approved. Please fix the boxes marked in red."}</span>
          )}
        </p>
      </div>
    </form>
  );
}

export function TurnDownForm({ id }) {
  const [state, action, pending] = useActionState(turnDownRequest.bind(null, id), { error: null });
  return (
    <form action={action} className="dash-delete">
      <details>
        <summary>Turn down this request</summary>
        <label className="dash-field">
          <span>Reason<span className="dash-optional"> (optional, only staff see it)</span></span>
          <textarea name="reason" rows={2} maxLength={1000} />
        </label>
        <button type="submit" className="dash-danger-button" disabled={pending}>{pending ? "Turning down…" : "Turn down"}</button>
        {state.error && <p className="dash-error" role="alert">{state.error}</p>}
      </details>
    </form>
  );
}
