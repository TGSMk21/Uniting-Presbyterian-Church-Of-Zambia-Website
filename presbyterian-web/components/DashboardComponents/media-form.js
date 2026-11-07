"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import { deleteMedia, saveMedia } from "@/app/dashboard/content-actions";
import { MEDIA_LIMITS } from "@/Utilities/mediaLibrary.mjs";
import { useConfirm } from "./confirm-dialog";

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

function DeleteButton({ branch, id }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState(null);
  const [confirm, dialog] = useConfirm();

  async function confirmDelete() {
    const sure = await confirm({
      title: "Delete this file?", message: "It will be removed for good. This can't be undone.",
      confirmLabel: "Delete", danger: true,
    });
    if (!sure) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteMedia(branch, id);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="dash-delete">
      <button type="button" className="dash-danger-button" onClick={confirmDelete} disabled={pending}>
        {pending ? "Deleting…" : "Delete this file"}
      </button>
      {error && <p className="dash-error" role="alert">{error}</p>}
      {dialog}
    </div>
  );
}

export default function MediaForm({ branch, id, values }) {
  const [state, action, pending] = useActionState(saveMedia.bind(null, branch, id), {
    error: null,
    fields: {},
    values: null,
  });
  const shown = state.values || values;
  const hasErrors = state.error || Object.keys(state.fields).length > 0;
  const invalid = (key) => (state.fields[key] ? true : undefined);

  return (
    <>
      <form action={action} className="dash-editor">
        <div className="dash-section">
          <Field label="Title" error={state.fields.title}>
            {/* The keys put typed values back after React clears the form. */}
            <input key={shown.title} type="text" name="title" defaultValue={shown.title} required
              maxLength={MEDIA_LIMITS.title} aria-invalid={invalid("title")} />
          </Field>
          <Field label="Description" optional error={state.fields.description}>
            <textarea key={shown.description} name="description" rows={4} defaultValue={shown.description}
              maxLength={MEDIA_LIMITS.description} aria-invalid={invalid("description")} />
          </Field>
          <Field label="Tags" optional help="With commas between them, like Easter, Youth." error={state.fields.tags}>
            <input key={shown.tags} type="text" name="tags" defaultValue={shown.tags} autoComplete="off"
              aria-invalid={invalid("tags")} />
          </Field>
        </div>
        <div className="dash-savebar">
          <button type="submit" className="btn-primary" disabled={pending}>{pending ? "Saving…" : "Save changes"}</button>
          <Link href={`/dashboard/content/${branch}/media`} className="dash-link" prefetch={false}>Cancel</Link>
          <p className="dash-savebar-status" role="status">
            {!pending && hasErrors && (
              <span className="dash-error">{state.error || "Nothing was saved. Please fix the boxes marked in red."}</span>
            )}
          </p>
        </div>
      </form>
      <DeleteButton branch={branch} id={id} />
    </>
  );
}
