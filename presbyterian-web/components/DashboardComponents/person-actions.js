"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { personAction } from "@/app/dashboard/staff-actions";
import { useConfirm } from "./confirm-dialog";
import { LinkMessage } from "./link-message";

const QUESTIONS = {
  suspend: { title: "Suspend this account?", message: "They'll be signed out straight away and can't sign in until it's restored.", confirmLabel: "Suspend", danger: true },
  restore: { title: "Restore this account?", message: "They'll be able to sign in again.", confirmLabel: "Restore" },
  "reset-password": { title: "Make a new set-password link?", message: "Their current password stops working and they're signed out until they use the link.", confirmLabel: "Make a link" },
  "reset-two-factor": { title: "Reset two-step login?", message: "They'll set it up again on their phone when they next sign in.", confirmLabel: "Reset", danger: true },
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
  const [confirm, dialog] = useConfirm();

  async function run(kind) {
    if (!(await confirm(QUESTIONS[kind]))) return;
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
          Make a new set-password link
        </button>
        {superuser && twoFactor && (
          <button type="button" className="dash-quiet-button" disabled={pending} onClick={() => run("reset-two-factor")}>
            Reset two-step login
          </button>
        )}
      </div>
      <div role="status">
        {outcome?.error && <p className="dash-error">{outcome.error}</p>}
        {outcome?.handover && (
          <div className="dash-handover">
            <p className="dash-text">
              New set-password link for <strong>{username}</strong>. Send them this message; the link works once, for 3 days,
              and won&apos;t be shown again.
            </p>
            <LinkMessage message={outcome.handover.message} />
          </div>
        )}
        {outcome?.done && DONE[outcome.done] && <p className="dash-notice">{DONE[outcome.done]}</p>}
      </div>
      {dialog}
    </section>
  );
}
