"use client";

import { useState, useTransition } from "react";
import { makeCalendarLink } from "@/app/dashboard/workspace-actions";

// Meetings in the phone's own calendar (Task 8.3, A7). The link is private: making a
// new one stops the old one, for a lost phone.
export default function CalendarLink() {
  const [link, setLink] = useState(null);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();

  const make = () => start(async () => {
    const result = await makeCalendarLink();
    if (result.signedOut) return window.location.assign("/dashboard/login");
    setError(result.error ?? null);
    if (result.ok) setLink(`${window.location.origin}/calendar/${result.token}.ics`);
  });
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  if (!link) {
    return (
      <div>
        <button type="button" className="btn-ghost" onClick={make} disabled={pending}>
          {pending ? "Making your link…" : "Add meetings to my phone's calendar"}
        </button>
        {error && <p className="dash-error" role="alert">{error}</p>}
      </div>
    );
  }
  return (
    <div className="dash-handover">
      <p className="dash-text">Tap below on your phone, or copy the link into your calendar app. Keep it to yourself.</p>
      <div className="ws-actions">
        <a className="btn-primary" href={link.replace(/^https?:/, "webcal:")}>Open in my calendar</a>
        <button type="button" className="btn-ghost" onClick={copy}>{copied ? "Copied" : "Copy the link"}</button>
      </div>
      <p className="dash-help">Making a new link stops this one working.</p>
    </div>
  );
}
