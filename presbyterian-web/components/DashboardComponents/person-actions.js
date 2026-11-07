"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { personAction } from "@/app/dashboard/staff-actions";

const QUESTIONS = {
  suspend: "Suspend this account? They'll be signed out straight away and can't sign in until it's restored.",
  restore: "Restore this account? They'll be able to sign in again.",
  "reset-password": "Give them a new temporary password? Their current password stops working and they're signed out.",
  "reset-two-factor": "Turn off their two-step login? They'll set it up again on their phone when they next sign in.",
};
const DONE = {
  suspend: "Suspended.",
  restore: "Restored.",
  "reset-two-factor": "Two-step login reset. They'll set it up again when they next sign in.",
};

export default function PersonActions({ id, username, isActive, superuser, twoFactor }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [outcome, setOutcome] = useState(null);

  function run(kind) {
    if (!window.confirm(QUESTIONS[kind])) return;
    setOutcome(null);
    startTransition(async () => {
      const result = await personAction(id, kind);
      setOutcome(result);
      if (!result.error) router.refresh();
    });
  }

  return (
    <section className="dash-panel">
      <h2 className="dash-subheading">Account</h2>
      <div className="dash-links dash-links-spaced">
        {isActive ? (
          <button type="button" className="dash-danger-button" disabled={pending} onClick={() => run("suspend")}>Suspend</button>
        ) : (
          <button type="button" className="dash-quiet-button" disabled={pending} onClick={() => run("restore")}>Restore</button>
        )}
        <button type="button" className="dash-quiet-button" disabled={pending} onClick={() => run("reset-password")}>
          Give a new temporary password
        </button>
        {superuser && twoFactor && (
          <button type="button" className="dash-quiet-button" disabled={pending} onClick={() => run("reset-two-factor")}>
            Reset two-step login
          </button>
        )}
      </div>
      <div role="status">
        {outcome?.error && <p className="dash-error">{outcome.error}</p>}
        {outcome?.password && (
          <div className="dash-handover">
            <p className="dash-text">
              New temporary password for <strong>{username}</strong>. Give it to them privately; it won&apos;t be shown again.
            </p>
            <p><code className="dash-secret">{outcome.password}</code></p>
          </div>
        )}
        {outcome?.done && DONE[outcome.done] && <p className="dash-notice">{DONE[outcome.done]}</p>}
      </div>
    </section>
  );
}
