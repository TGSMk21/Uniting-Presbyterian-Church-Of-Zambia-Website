"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// A question before something that can't easily be undone (Task 7.3), in place of the
// browser's own pop-up. The browser's <dialog> handles focus, Escape and screen readers.
function ConfirmDialog({ title, message, confirmLabel, danger, onAnswer }) {
  const ref = useRef(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog.showModal();
    return () => dialog.open && dialog.close();
  }, []);

  return (
    <dialog ref={ref} className="dash-dialog" aria-labelledby="dash-dialog-title"
      onCancel={(event) => { event.preventDefault(); onAnswer(false); }}>
      <h2 id="dash-dialog-title" className="dash-subheading">{title}</h2>
      <p className="dash-text">{message}</p>
      <div className="dash-dialog-actions">
        <button type="button" className="btn-ghost" autoFocus onClick={() => onAnswer(false)}>Cancel</button>
        <button type="button" className={danger ? "dash-danger-button dash-danger-solid" : "btn-primary"} onClick={() => onAnswer(true)}>
          {confirmLabel}
        </button>
      </div>
    </dialog>
  );
}

// const [confirm, dialog] = useConfirm(); ... if (!(await confirm({...}))) return; ... render {dialog}
export function useConfirm() {
  const [question, setQuestion] = useState(null);
  const confirm = useCallback(
    ({ title, message, confirmLabel = "Continue", danger = false }) =>
      new Promise((resolve) => setQuestion({ title, message, confirmLabel, danger, resolve })),
    [],
  );
  const answer = (value) => {
    question?.resolve(value);
    setQuestion(null);
  };
  const dialog = question ? <ConfirmDialog {...question} onAnswer={answer} /> : null;
  return [confirm, dialog];
}
