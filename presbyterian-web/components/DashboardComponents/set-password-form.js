"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { checkPasswordLink, setPasswordFromLink } from "@/app/dashboard/access-actions";
import { linkTokenFrom } from "@/Utilities/accessRequests.mjs";

const NO_LINK = "This page needs the link you were sent. Please open the whole link again.";

function Choose({ token, username, firstName }) {
  const [state, action, pending] = useActionState(setPasswordFromLink.bind(null, token), { done: false, error: null, fields: {} });

  if (state.done) {
    return (
      <>
        <p className="dash-notice" role="status">Your password is set.</p>
        <p className="dash-text">
          Sign in with your username <strong>{state.username}</strong> and your new password. You may be asked to set up
          two-step login on your phone next.
        </p>
        <Link href="/dashboard/login" className="btn-primary dash-submit" prefetch={false}>Sign in</Link>
      </>
    );
  }

  return (
    <form action={action} className="dash-form">
      <p className="dash-text">
        {firstName ? `Welcome, ${firstName}. ` : ""}Your username is <strong>{username}</strong>.
      </p>
      {/* Lets password managers save the username with the password. */}
      <input type="text" name="username" value={username} autoComplete="username" readOnly hidden />
      <label className="dash-field">
        <span>New password</span>
        <input name="password" type="password" autoComplete="new-password" minLength={8} required aria-invalid={state.fields.password ? true : undefined} />
        <small>At least 8 characters. Avoid common passwords, your name, and numbers on their own.</small>
        {state.fields.password && <span className="dash-field-error" role="alert">{state.fields.password}</span>}
      </label>
      <label className="dash-field">
        <span>New password again</span>
        <input name="confirm" type="password" autoComplete="new-password" minLength={8} required aria-invalid={state.fields.confirm ? true : undefined} />
        {state.fields.confirm && <span className="dash-field-error" role="alert">{state.fields.confirm}</span>}
      </label>
      <p className="dash-error" role="alert">{state.error}</p>
      <button type="submit" className="btn-primary dash-submit" disabled={pending}>
        {pending ? "Saving…" : "Save my password"}
      </button>
    </form>
  );
}

export default function SetPasswordForm() {
  const [link, setLink] = useState({ checking: true });
  // Read once: React may run this twice while developing, after the address is cleared.
  const read = useRef(undefined);

  useEffect(() => {
    if (read.current === undefined) read.current = linkTokenFrom(window.location.hash);
    const token = read.current;
    // Take the secret out of the address bar, so it isn't left on screen or in history.
    window.history.replaceState(null, "", window.location.pathname);
    if (!token) {
      setLink({ error: NO_LINK });
      return;
    }
    checkPasswordLink(token)
      .then((answer) => setLink(answer.error ? { error: answer.error } : { token, ...answer }))
      .catch(() => setLink({ error: "This isn't working right now. Please try again in a few minutes." }));
  }, []);

  if (link.checking) return <p className="dash-text" role="status">Checking your link…</p>;
  if (link.error) return <p className="dash-error" role="alert">{link.error}</p>;
  return <Choose token={link.token} username={link.username} firstName={link.firstName} />;
}
