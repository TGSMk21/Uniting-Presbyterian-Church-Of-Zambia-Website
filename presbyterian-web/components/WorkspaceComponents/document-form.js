"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { FileUp, PenLine } from "lucide-react";
import { createDocument } from "@/app/dashboard/workspace-actions";

// A new document (Task 8.5): upload a file, or write it here. It stays private until
// the author has checked it and chosen who may see it, unless it's for a meeting.
export default function DocumentForm({ meeting = null }) {
  const [state, action, pending] = useActionState(createDocument, {});
  const [mode, setMode] = useState("file");

  return (
    <form action={action} className="dash-form ws-meeting-form">
      <div className="ws-segmented" role="radiogroup" aria-label="How to add it">
        {[{ value: "file", label: "Upload a file", Icon: FileUp }, { value: "text", label: "Write it here", Icon: PenLine }]
          .map(({ value, label, Icon }) => (
            <label key={value} className={mode === value ? "is-on" : undefined}>
              <input type="radio" name="mode" value={value} checked={mode === value} onChange={() => setMode(value)} />
              <Icon size={16} aria-hidden="true" /> {label}
            </label>
          ))}
      </div>

      <label className="dash-field">
        <span>Name</span>
        <input name="title" type="text" required maxLength={200} placeholder="e.g. Minutes of the October session" />
      </label>

      {mode === "file" ? (
        <label className="dash-field">
          <span>File</span>
          <input name="file" type="file" required
            accept=".pdf,.docx,.xlsx,.pptx,.txt,.jpg,.jpeg,.png,.webp,application/pdf,image/*" />
          <span className="dash-help">PDF, Word, Excel, PowerPoint, text or a picture, up to 4 MB.</span>
        </label>
      ) : (
        <label className="dash-field">
          <span>Words</span>
          <textarea name="text" rows={14} required maxLength={100000} />
        </label>
      )}

      <label className="dash-field">
        <span>About it <span className="dash-optional">optional</span></span>
        <input name="description" type="text" maxLength={1000} placeholder="A line to say what it is" />
      </label>

      {meeting && <input type="hidden" name="meeting" value={meeting.id} />}
      {state.error && <p className="dash-error" role="alert">{state.error}</p>}
      <div className="ws-form-actions">
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? "Saving…" : meeting ? `Save and share with ${meeting.title}` : "Save"}
        </button>
        <Link href={meeting ? `/dashboard/meetings/${meeting.id}` : "/dashboard/documents"} className="btn-ghost">Cancel</Link>
      </div>
      {!meeting && (
        <p className="dash-help">Only you can see it until you share it, so you can read it through first.</p>
      )}
    </form>
  );
}
