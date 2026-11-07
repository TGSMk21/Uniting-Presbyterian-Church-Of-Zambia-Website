"use client";

import { useActionState } from "react";
import { removePageImage, savePageContent, uploadPageImage } from "@/app/dashboard/actions";
import ImageField from "./image-field";
import { useUnsavedChanges } from "./unsaved-changes";

const HELP = {
  title: "Put *stars* around words to show them in italics. Press Enter for a new line.",
  list: "One point per line.",
};

function Field({ field, value, error }) {
  const help = [HELP[field.type], field.default.includes("{branch}") && "{branch} shows the branch's name."]
    .filter(Boolean)
    .join(" ");
  const shared = {
    name: field.key,
    defaultValue: value,
    maxLength: field.max,
    "aria-invalid": error ? true : undefined,
  };
  const multiline = ["title", "text", "list"].includes(field.type);
  const rows = field.type === "title" ? 2 : field.type === "list" ? 6 : 4;
  const inputType = { email: "email", phone: "tel" }[field.type] || "text";

  return (
    <label className="dash-field">
      <span>{field.label}</span>
      {/* The key resets the box when the saved value changes, such as after clearing it. */}
      {multiline ? (
        <textarea key={value} rows={rows} {...shared} />
      ) : (
        <input key={value} type={inputType} {...shared} />
      )}
      {help && <small>{help}</small>}
      {error && <span className="dash-field-error" role="alert">{error}</span>}
    </label>
  );
}

export default function PageEditor({ scope, page, sections, values, viewHref }) {
  const unsaved = useUnsavedChanges();
  const [state, action, pending] = useActionState(savePageContent.bind(null, scope, page), {
    saved: false,
    error: null,
    fields: {},
  });
  const hasErrors = state.error || Object.keys(state.fields).length > 0;

  return (
    <form action={action} className="dash-editor" {...unsaved}>
      {sections.map((section) => (
        <fieldset key={section.title} className="dash-section">
          <legend>{section.title}</legend>
          {section.fields.map((field) =>
            field.type === "image" ? (
              <ImageField
                key={field.key}
                field={field}
                value={values[field.key]}
                viewHref={viewHref}
                upload={(form) => uploadPageImage(scope, page, field.key, form)}
                remove={() => removePageImage(scope, page, field.key)}
              />
            ) : (
              <Field
                key={field.key}
                field={field}
                value={values[field.key] ?? field.default}
                error={state.fields[field.key]?.join(" ")}
              />
            ),
          )}
        </fieldset>
      ))}

      <div className="dash-savebar">
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? "Saving…" : "Save changes"}
        </button>
        <p className="dash-savebar-status" role="status">
          {pending ? "" : state.saved && !hasErrors ? (
            <>
              Saved.{" "}
              <a href={viewHref} target="_blank" rel="noopener">View the page</a>
            </>
          ) : (
            <span className="dash-error">
              {state.error || (hasErrors && "Nothing was saved. Please fix the boxes marked in red.")}
            </span>
          )}
        </p>
      </div>
    </form>
  );
}
