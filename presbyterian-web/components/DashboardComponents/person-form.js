"use client";

import { useActionState } from "react";
import Link from "next/link";
import { addPerson, savePerson } from "@/app/dashboard/staff-actions";
import { STAFF_ROLES, ministerGroups } from "@/Utilities/staffAdmin.mjs";

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

// The username and temporary password, shown once after adding someone.
function Added({ added }) {
  return (
    <div className="dash-panel dash-handover" role="status">
      <h2 className="dash-subheading">Account made</h2>
      <p className="dash-text">
        Give these to them privately, in person or by phone, not by plain email. They&apos;ll choose their own
        password when they first sign in at <strong>/dashboard</strong>. This password won&apos;t be shown again.
      </p>
      <dl className="dash-details">
        <div><dt>Username</dt><dd><code>{added.username}</code></dd></div>
        <div><dt>Temporary password</dt><dd><code className="dash-secret">{added.password}</code></dd></div>
      </dl>
      <div className="dash-links">
        <Link href={`/dashboard/staff/${added.id}`} className="dash-link" prefetch={false}>See their account</Link>
        <Link href="/dashboard/staff" className="dash-link" prefetch={false}>Back to Staff</Link>
      </div>
    </div>
  );
}

// `id` is null when adding someone. `branches` and `ministers` are only given to superusers.
export default function PersonForm({ id, values, superuser, branches = [], ministers = [], branchName }) {
  const isNew = id === null;
  const [state, action, pending] = useActionState(isNew ? addPerson : savePerson.bind(null, id), {
    added: null,
    error: null,
    fields: {},
    values: null,
  });
  if (state.added) return <Added added={state.added} />;

  const shown = { ...values, ...(state.values || {}) };
  const hasErrors = state.error || Object.keys(state.fields).length > 0;
  const invalid = (key) => (state.fields[key] ? true : undefined);
  // The keys put typed values back after React clears the form.
  const box = (key, props) => (
    <input key={shown[key] ?? ""} name={key} defaultValue={shown[key] ?? ""} aria-invalid={invalid(key)} {...props} />
  );

  return (
    <form action={action} className="dash-editor">
      <div className="dash-section">
        {isNew && (
          <Field label="Username" help="What they'll sign in with. Small letters, numbers and . _ - only; it can't be changed later."
            error={state.fields.username}>
            {box("username", { type: "text", required: true, maxLength: 150, autoComplete: "off", autoCapitalize: "none", spellCheck: false })}
          </Field>
        )}
        <Field label="First name" optional error={state.fields.first_name}>
          {box("first_name", { type: "text", maxLength: 150 })}
        </Field>
        <Field label="Last name" optional error={state.fields.last_name}>
          {box("last_name", { type: "text", maxLength: 150 })}
        </Field>
        <Field label="Email" optional error={state.fields.email}>
          {box("email", { type: "email", maxLength: 254 })}
        </Field>
        {superuser ? (
          <>
            <Field label="Role" error={state.fields.role}
              help="Branch admins can also add and suspend their branch's content editors.">
              <select key={shown.role ?? ""} name="role" defaultValue={shown.role || "content_editor"} aria-invalid={invalid("role")}>
                {STAFF_ROLES.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
              </select>
            </Field>
            <Field label="Branch" error={state.fields.branch}>
              <select key={shown.branch ?? ""} name="branch" defaultValue={shown.branch || ""} required aria-invalid={invalid("branch")}>
                <option value="">Choose a branch</option>
                {branches.map(({ slug, name }) => <option key={slug} value={slug}>{name}</option>)}
              </select>
            </Field>
            <Field label="Minister" optional error={state.fields.minister}
              help="For a minister's own account: choose them here. It must be a Branch Admin of the minister's branch.">
              <select key={shown.minister ?? ""} name="minister" defaultValue={shown.minister ?? ""} aria-invalid={invalid("minister")}>
                <option value="">Not a minister</option>
                {ministerGroups(ministers, branches, values.username).map((group) => (
                  <optgroup key={group.label} label={group.label}>
                    {group.options.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
                  </optgroup>
                ))}
              </select>
            </Field>
          </>
        ) : (
          isNew && <p className="dash-text">They&apos;ll be a content editor for {branchName}.</p>
        )}
      </div>
      <div className="dash-savebar">
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? "Saving…" : isNew ? "Make the account" : "Save changes"}
        </button>
        <Link href={isNew ? "/dashboard/staff" : `/dashboard/staff/${id}`} className="dash-link" prefetch={false}>Cancel</Link>
        <p className="dash-savebar-status" role="status">
          {!pending && hasErrors && (
            <span className="dash-error">{state.error || "Nothing was saved. Please fix the boxes marked in red."}</span>
          )}
        </p>
      </div>
    </form>
  );
}
