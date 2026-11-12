"use client";

import { useActionState } from "react";
import Link from "next/link";
import { addBranch, saveBranch } from "@/app/dashboard/staff-actions";

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

// `slug` is null when adding a branch.
export default function BranchAdminForm({ slug, values, presbyteries = [] }) {
  const isNew = slug === null;
  const [state, action, pending] = useActionState(isNew ? addBranch : saveBranch.bind(null, slug), {
    error: null,
    fields: {},
    values: null,
  });
  const shown = { ...values, ...(state.values || {}) };
  const hasErrors = state.error || Object.keys(state.fields).length > 0;
  const invalid = (key) => (state.fields[key] ? true : undefined);
  const box = (key, props) => (
    <input key={shown[key] ?? ""} name={key} defaultValue={shown[key] ?? ""} aria-invalid={invalid(key)} {...props} />
  );
  const active = state.values ? state.values.is_active === "on" : Boolean(values.is_active);

  return (
    <form action={action} className="dash-editor">
      <div className="dash-section">
        <Field label="Name" error={state.fields.name}>
          {box("name", { type: "text", required: true, maxLength: 200 })}
        </Field>
        {isNew && (
          <Field label="Web address" error={state.fields.slug}
            help="The branch's pages will be at /this-address. Small letters, numbers and dashes, like st-pauls-kabwe. It can't be changed later.">
            {box("slug", { type: "text", required: true, maxLength: 50, autoComplete: "off", autoCapitalize: "none", spellCheck: false })}
          </Field>
        )}
        <Field label="Contact email" optional error={state.fields.contact_email}
          help="Messages from the branch's Contact page go here. Its staff can change it later.">
          {box("contact_email", { type: "email", maxLength: 254 })}
        </Field>
        <Field label="YouTube channel ID" optional error={state.fields.youtube_channel_id}
          help="UC followed by 22 letters and numbers. Sermons are brought in from this channel by themselves.">
          {box("youtube_channel_id", { type: "text", maxLength: 24, autoComplete: "off", spellCheck: false })}
        </Field>
        <Field label="Presbytery" optional error={state.fields.presbytery}
          help="Which presbytery it belongs to, for the shared workspace's meetings and documents.">
          <select key={shown.presbytery ?? ""} name="presbytery" defaultValue={shown.presbytery ?? ""} aria-invalid={invalid("presbytery")}>
            <option value="">Not in a presbytery yet</option>
            {presbyteries.map(({ slug: value, name }) => <option key={value} value={value}>{name}</option>)}
          </select>
        </Field>
        {!isNew && (
          <>
            <label className="dash-check">
              <input key={String(active)} type="checkbox" name="is_active" defaultChecked={active} />
              <span>Show this branch on the website</span>
            </label>
            <small className="dash-help">
              Unticked, its pages and its place in Find a Branch disappear, and its staff can&apos;t change its content.
              Nothing is deleted; tick it again to bring it back.
            </small>
          </>
        )}
      </div>
      <div className="dash-savebar">
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? "Saving…" : isNew ? "Add the branch" : "Save changes"}
        </button>
        <Link href="/dashboard/branches" className="dash-link" prefetch={false}>Cancel</Link>
        <p className="dash-savebar-status" role="status">
          {!pending && hasErrors && (
            <span className="dash-error">{state.error || "Nothing was saved. Please fix the boxes marked in red."}</span>
          )}
        </p>
      </div>
    </form>
  );
}
