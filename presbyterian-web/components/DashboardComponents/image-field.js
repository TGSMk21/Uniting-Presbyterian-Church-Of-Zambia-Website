"use client";

import { useId, useRef, useState } from "react";
import { removePageImage, uploadPageImage } from "@/app/dashboard/actions";
import { IMAGE_TYPES, shrinkImage } from "@/Utilities/imageUpload.mjs";

const TRY_AGAIN = "The photo couldn't be saved right now. Please try again in a moment.";

export default function ImageField({ scope, page, field, value, viewHref }) {
  const [custom, setCustom] = useState(value || "");
  const [chosen, setChosen] = useState(null);
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState(null);
  const fileInput = useRef(null);
  const inputId = useId();

  function dropChosen() {
    if (chosen) URL.revokeObjectURL(chosen.preview);
    setChosen(null);
    if (fileInput.current) fileInput.current.value = "";
  }

  async function choose(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setOutcome(null);
    if (chosen) URL.revokeObjectURL(chosen.preview);
    setChosen(null);
    try {
      const blob = await shrinkImage(file, field);
      setChosen({ blob, preview: URL.createObjectURL(blob) });
    } catch (error) {
      if (fileInput.current) fileInput.current.value = "";
      setOutcome({ error: error.message });
    }
  }

  async function run(action, onSuccess) {
    setBusy(true);
    setOutcome(null);
    try {
      const result = await action();
      if (result.signedOut) {
        window.location.assign("/dashboard/login");
        return;
      }
      if (result.error) {
        setOutcome({ error: result.error });
      } else {
        onSuccess(result);
        setOutcome({ saved: true });
      }
    } catch {
      // Such as the connection dropping part way through.
      setOutcome({ error: TRY_AGAIN });
    } finally {
      setBusy(false);
    }
  }

  function saveChosen() {
    const form = new FormData();
    form.append("image", chosen.blob, "photo");
    run(
      () => uploadPageImage(scope, page, field.key, form),
      (result) => {
        setCustom(result.url);
        dropChosen();
      },
    );
  }

  function removeCustom() {
    run(
      () => removePageImage(scope, page, field.key),
      () => setCustom(""),
    );
  }

  const shown = chosen?.preview || custom || field.default;
  const removeLabel = field.default ? "Go back to the original" : "Remove this photo";

  return (
    <div className="dash-image">
      <label className="dash-field" htmlFor={inputId}>{field.label}</label>
      <div className="dash-image-row">
        <div className="dash-image-frame">
          {shown ? (
            <img src={shown} alt={chosen ? `New ${field.label}, not saved yet` : `Current ${field.label}`} />
          ) : (
            <span>No photo yet</span>
          )}
        </div>
        <div className="dash-image-controls">
          <input
            id={inputId}
            ref={fileInput}
            type="file"
            accept={IMAGE_TYPES}
            disabled={busy}
            onChange={choose}
            className="dash-image-input"
          />
          <small>JPG, PNG or WebP. Large photos are made smaller for you.</small>
          <div className="dash-image-actions">
            {chosen ? (
              <>
                <button type="button" className="btn-primary" disabled={busy} onClick={saveChosen}>
                  {busy ? "Saving…" : "Use this photo"}
                </button>
                <button type="button" className="dash-quiet-button" disabled={busy} onClick={dropChosen}>
                  Cancel
                </button>
              </>
            ) : (
              custom && (
                <button type="button" className="dash-quiet-button" disabled={busy} onClick={removeCustom}>
                  {busy ? "Saving…" : removeLabel}
                </button>
              )
            )}
          </div>
          <p className="dash-image-status" role="status">
            {outcome?.saved && (
              <>
                Saved. <a href={viewHref} target="_blank" rel="noopener">View the page</a>
              </>
            )}
            {outcome?.error && <span className="dash-error">{outcome.error}</span>}
          </p>
        </div>
      </div>
    </div>
  );
}
