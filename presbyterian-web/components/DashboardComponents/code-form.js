"use client";

import { useActionState } from "react";
import { verifyCode } from "@/app/dashboard/actions";

export default function CodeForm() {
  const [state, action, pending] = useActionState(verifyCode, { error: null });

  return (
    <form action={action} className="dash-form">
      <label className="dash-field">
        <span>Code</span>
        <input name="code" type="text" autoComplete="one-time-code" autoCapitalize="none" spellCheck="false" autoFocus required />
        <small>Lost your phone? Enter one of your recovery codes instead.</small>
      </label>
      <p className="dash-error" role="alert">{state.error}</p>
      <button type="submit" className="btn-primary dash-submit" disabled={pending}>
        {pending ? "Checking…" : "Continue"}
      </button>
    </form>
  );
}
