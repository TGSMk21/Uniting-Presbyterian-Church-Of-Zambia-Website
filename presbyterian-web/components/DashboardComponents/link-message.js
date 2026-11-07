"use client";

import { useState } from "react";

// A set-password message to send on, with Copy and Open in WhatsApp (Task 7.2, decision D3).
export function LinkMessage({ message }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }
  return (
    <>
      <textarea readOnly rows={6} value={message} aria-label="Message to send" />
      <div className="dash-links">
        <button type="button" className="btn-ghost dash-copy" onClick={copy}>{copied ? "Copied" : "Copy message"}</button>
        <a href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer" className="dash-link">
          Open in WhatsApp
        </a>
      </div>
    </>
  );
}
