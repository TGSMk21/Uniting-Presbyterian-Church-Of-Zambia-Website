"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { addPresbytery } from "@/app/dashboard/workspace-actions";

// Superusers add a presbytery (Task 8.1); branches are placed in it from each branch's page.
export default function AddPresbytery() {
  const router = useRouter();
  const [state, action, pending] = useActionState(addPresbytery, {});
  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state, router]);

  return (
    <form action={action} className="ws-inline-form">
      <label className="dash-field">
        <span>Add a presbytery</span>
        <input name="name" type="text" maxLength={100} required placeholder="e.g. DR Congo" />
      </label>
      <button type="submit" className="btn-primary" disabled={pending}>{pending ? "Adding…" : "Add"}</button>
      {state.error && <p className="dash-error" role="alert">{state.error}</p>}
      {state.ok && <p className="dash-notice" role="status">{state.added} Presbytery added.</p>}
    </form>
  );
}
