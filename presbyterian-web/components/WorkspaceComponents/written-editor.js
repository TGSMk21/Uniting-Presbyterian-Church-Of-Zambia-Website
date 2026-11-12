"use client";

import { useActionState } from "react";
import Link from "next/link";
import { newVersion } from "@/app/dashboard/workspace-actions";

export default function WrittenEditor({ document }) {
  const [state, action, pending] = useActionState(newVersion.bind(null, document.id), {});
  return (
    <form action={action} className="dash-form ws-meeting-form">
      <input type="hidden" name="mode" value="text" />
      <label className="dash-field">
        <span>Words</span>
        <textarea name="text" rows={18} required maxLength={100000} defaultValue={document.text} />
      </label>
      <label className="dash-field">
        <span>What changed <span className="dash-optional">optional</span></span>
        <input name="note" type="text" maxLength={300} placeholder="e.g. Added the date of the next meeting" />
      </label>
      {state.error && <p className="dash-error" role="alert">{state.error}</p>}
      <div className="ws-form-actions">
        <button type="submit" className="btn-primary" disabled={pending}>{pending ? "Saving…" : "Save as a new version"}</button>
        <Link href={`/dashboard/documents/${document.id}`} className="btn-ghost">Cancel</Link>
      </div>
      <p className="dash-help">The earlier version is kept, and can be brought back.</p>
    </form>
  );
}
