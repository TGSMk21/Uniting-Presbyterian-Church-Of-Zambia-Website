"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import { deleteBranchContent, saveBranchContent } from "@/app/dashboard/content-actions";
import { SECTIONS } from "@/Utilities/branchContent.mjs";
import { useConfirm } from "./confirm-dialog";

const INPUT_TYPES = { datetime: "datetime-local", date: "date", time: "time", number: "number" };

function Box({ field, value, error, choices }) {
  const invalid = error ? true : undefined;
  if (field.type === "checkbox") {
    return (
      <label className="dash-check">
        <input key={String(value)} type="checkbox" name={field.key} defaultChecked={value} />
        <span>{field.label}</span>
      </label>
    );
  }

  const shared = { name: field.key, defaultValue: value, required: field.required, "aria-invalid": invalid };
  let input;
  if (field.type === "textarea") {
    input = <textarea key={value} rows={field.rows || 6} maxLength={field.max} {...shared} />;
  } else if (field.type === "select") {
    input = (
      <select key={value} {...shared}>
        {(field.options || choices[field.choices] || []).map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    );
  } else if (field.type === "number") {
    input = <input key={value} type="number" min={field.min} max={field.max} step="1" inputMode="numeric" {...shared} />;
  } else {
    const type = INPUT_TYPES[field.type] || "text";
    input = <input key={value} type={type} maxLength={type === "text" ? field.max : undefined} {...shared} />;
  }

  return (
    <label className="dash-field">
      <span>{field.label}{!field.required && <span className="dash-optional"> (optional)</span>}</span>
      {/* The key puts typed values back after React clears the form. */}
      {input}
      {field.help && <small>{field.help}</small>}
      {error && <span className="dash-field-error" role="alert">{error}</span>}
    </label>
  );
}

function DeleteButton({ branch, name, id }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState(null);
  const [confirm, dialog] = useConfirm();
  const spec = SECTIONS[name];
  const { singular } = spec;
  // Private sections, such as written sermons, were never on the website.
  const where = spec.publicPath ? " It will be removed from the website." : "";

  async function confirmDelete() {
    const sure = await confirm({
      title: `Delete this ${singular}?`, message: `${where.trim()} This can't be undone.`.trim(),
      confirmLabel: "Delete", danger: true,
    });
    if (!sure) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteBranchContent(branch, name, id);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="dash-delete">
      <button type="button" className="dash-danger-button" onClick={confirmDelete} disabled={pending}>
        {pending ? "Deleting…" : `Delete this ${singular}`}
      </button>
      {error && <p className="dash-error" role="alert">{error}</p>}
      {dialog}
    </div>
  );
}

// `choices` fills select boxes whose options come from the page, such as the branch's ministers.
export default function ContentForm({ branch, name, id, values, choices = {} }) {
  const spec = SECTIONS[name];
  const isNew = id === null;
  const [state, action, pending] = useActionState(saveBranchContent.bind(null, branch, name, id), {
    error: null,
    fields: {},
    values: null,
  });
  const shown = state.values || values;
  const hasErrors = state.error || Object.keys(state.fields).length > 0;
  const fields = spec.fields.filter((field) => isNew || !field.newOnly);

  return (
    <>
      <form action={action} className="dash-editor">
        <div className="dash-section">
          {fields.map((field) => (
            <Box key={field.key} field={field} value={shown[field.key] ?? ""} error={state.fields[field.key]} choices={choices} />
          ))}
        </div>
        <div className="dash-savebar">
          <button type="submit" className="btn-primary" disabled={pending}>
            {pending ? "Saving…" : isNew ? `Add ${spec.singular}` : "Save changes"}
          </button>
          <Link href={`/dashboard/content/${branch}/${name}`} className="dash-link" prefetch={false}>Cancel</Link>
          <p className="dash-savebar-status" role="status">
            {!pending && hasErrors && (
              <span className="dash-error">{state.error || "Nothing was saved. Please fix the boxes marked in red."}</span>
            )}
          </p>
        </div>
      </form>
      {!isNew && spec.canDelete && <DeleteButton branch={branch} name={name} id={id} />}
    </>
  );
}
