"use client";

import { useActionState } from "react";
import { changePassword } from "@/app/dashboard/actions";

export default function PasswordForm() {
  const [state, action, pending] = useActionState(changePassword, { error: null });

  return (
    <form action={action} className="dash-form">
      <label className="dash-field">
        <span>Current password</span>
        <input name="current" type="password" autoComplete="current-password" required />
      </label>
      <label className="dash-field">
        <span>New password</span>
        <input name="new" type="password" autoComplete="new-password" minLength={8} required />
        <small>At least 8 characters. Avoid common passwords and numbers on their own.</small>
      </label>
      <label className="dash-field">
        <span>New password again</span>
        <input name="confirm" type="password" autoComplete="new-password" minLength={8} required />
      </label>
      <p className="dash-error" role="alert">{state.error}</p>
      <button type="submit" className="btn-primary dash-submit" disabled={pending}>
        {pending ? "Saving…" : "Save new password"}
      </button>
    </form>
  );
}
