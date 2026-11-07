"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setMessageStatus } from "@/app/dashboard/content-actions";
import { aiDraftNote, publishedNote } from "@/Utilities/branchContent.mjs";
import { messageParagraphs, reviewActions, statusLabel } from "@/Utilities/messageReview.mjs";
import { useConfirm } from "./confirm-dialog";

const CONFIRM = {
  rejected: {
    title: "Turn down this message?", message: "It stays here, off the website, and can be brought back to draft later.",
    confirmLabel: "Turn down", danger: true,
  },
  pending_review: {
    title: "Take this message off the website?", message: "It goes back to being a draft.", confirmLabel: "Unpublish",
  },
};
const BUTTON = { primary: "btn-primary", secondary: "btn-ghost", danger: "dash-danger-button" };

function day(iso) {
  return new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })
    .format(new Date(`${iso}T12:00:00Z`));
}

// The message as the website will show it, with what to do next (Task 7.3).
export default function MessageReview({ branch, id, message }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState(null);
  const [confirm, dialog] = useConfirm();
  const label = statusLabel(message);
  const note = aiDraftNote(message);

  async function act(status) {
    // Publishing needs no question; taking a message away does.
    const question = status === "rejected" ? CONFIRM.rejected : message.status === "published" ? CONFIRM.pending_review : null;
    if (question && !(await confirm(question))) return;
    setError(null);
    startTransition(async () => {
      const result = await setMessageStatus(branch, id, status);
      if (result.error) setError(result.error);
      else router.refresh();
    });
  }

  return (
    <section className="dash-review" aria-labelledby="review-heading">
      <div className="dash-review-bar">
        <span className={`dash-badge dash-badge-${label.tone}`}>{label.text}</span>
        <span className="dash-review-when">For {day(message.date)} · {message.minister_name}</span>
        <div className="dash-review-actions">
          {reviewActions(message.status).map(({ status, label: text, kind }) => (
            <button key={status} type="button" className={BUTTON[kind]} disabled={pending} onClick={() => act(status)}>
              {pending ? "Saving…" : text}
            </button>
          ))}
        </div>
      </div>
      {error && <p className="dash-error" role="alert">{error}</p>}
      {note && <p className="dash-notice dash-notice-ai">{note}</p>}
      {message.status === "published" && message.published_at && <p className="dash-text">{publishedNote(message)}</p>}

      <article className="dash-preview" aria-label="How it will look on the website">
        <p className="dash-preview-kicker">Daily message · {day(message.date)}</p>
        <h2 id="review-heading" className="dash-preview-title">{message.title}</h2>
        {(message.verse_text || message.reference_verse) && (
          <blockquote className="dash-preview-verse">
            {message.verse_text && <p>“{message.verse_text}”</p>}
            {message.reference_verse && <cite>{message.reference_verse}</cite>}
          </blockquote>
        )}
        {messageParagraphs(message.message).map((paragraph, index) => (
          <p key={index} className="dash-preview-text">{paragraph}</p>
        ))}
        <p className="dash-preview-sign">Rev. {message.minister_name}</p>
      </article>
      {dialog}
    </section>
  );
}
