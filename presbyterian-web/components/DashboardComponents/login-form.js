"use client";

import { useActionState } from "react";
import { signIn } from "@/app/dashboard/actions";

export default function LoginForm() {
  const [state, action, pending] = useActionState(signIn, { error: null });

  return (
    <form action={action} className="dash-form">
      <label className="dash-field">
        <span>Username</span>
        <input name="username" type="text" autoComplete="username" autoCapitalize="none" spellCheck="false" required />
      </label>
      <label className="dash-field">
        <span>Password</span>
        <input name="password" type="password" autoComplete="current-password" required />
      </label>
      <p className="dash-error" role="alert">{state.error}</p>
      <button type="submit" className="btn-primary dash-submit" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
