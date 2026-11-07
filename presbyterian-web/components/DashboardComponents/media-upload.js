"use client";

import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { uploadMedia } from "@/app/dashboard/content-actions";
import { shrinkImage } from "@/Utilities/imageUpload.mjs";
import { ACCEPT, MEDIA_LIMITS, checkBeforeUpload, isPhoto, photoSpec } from "@/Utilities/mediaLibrary.mjs";

const TRY_AGAIN = "The file couldn't be added right now. Please try again in a moment.";

export default function MediaUpload({ branch }) {
  const router = useRouter();
  const form = useRef(null);
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState({ error: null, fields: {} });
  const fileId = useId();

  async function submit(event) {
    event.preventDefault();
    const typed = new FormData(form.current);
    const file = typed.get("file");
    // With nothing chosen, browsers still send an empty, nameless file.
    const chosen = file instanceof File && file.name ? file : undefined;
    const problem = checkBeforeUpload(chosen);
    if (problem) {
      setOutcome({ error: null, fields: { file: problem } });
      return;
    }
    setBusy(true);
    setOutcome({ error: null, fields: {} });
    try {
      // Phone photos are often larger than the website's host accepts, so they're made smaller here first.
      if (isPhoto(chosen)) {
        const smaller = await shrinkImage(chosen, photoSpec(chosen));
        typed.set("file", smaller, chosen.name);
      }
      const result = await uploadMedia(branch, typed);
      if (result.signedOut) {
        window.location.assign("/dashboard/login");
        return;
      }
      if (result.id) {
        form.current.reset();
        router.push(`/dashboard/content/${branch}/media?saved=added`);
        router.refresh();
        return;
      }
      setOutcome({ error: result.error, fields: result.fields || {} });
    } catch (error) {
      // shrinkImage explains itself; anything else is likely the connection.
      setOutcome({ error: null, fields: { file: error?.message && isPhoto(chosen) ? error.message : TRY_AGAIN } });
    } finally {
      setBusy(false);
    }
  }

  const { fields } = outcome;
  return (
    <form ref={form} onSubmit={submit} className="dash-editor dash-media-upload" noValidate>
      <fieldset className="dash-section">
        <legend>Add a file</legend>
        <label className="dash-field" htmlFor={fileId}>
          <span>File</span>
          <input id={fileId} type="file" name="file" accept={ACCEPT} required aria-invalid={fields.file ? true : undefined} />
          <small>
            Photos, PDFs, Word, Excel and PowerPoint files, and MP3 or M4A recordings, up to 4 MB. Photos are made
            smaller and have hidden details, such as where they were taken, removed. Only your branch&apos;s staff can see
            these files.
          </small>
          {fields.file && <span className="dash-field-error" role="alert">{fields.file}</span>}
        </label>
        <label className="dash-field">
          <span>Title<span className="dash-optional"> (optional)</span></span>
          <input type="text" name="title" maxLength={MEDIA_LIMITS.title} aria-invalid={fields.title ? true : undefined} />
          <small>Leave empty to use the file&apos;s name.</small>
          {fields.title && <span className="dash-field-error" role="alert">{fields.title}</span>}
        </label>
        <label className="dash-field">
          <span>Tags<span className="dash-optional"> (optional)</span></span>
          <input type="text" name="tags" autoComplete="off" aria-invalid={fields.tags ? true : undefined} />
          <small>Words to find it by, with commas between them, like Easter, Youth.</small>
          {fields.tags && <span className="dash-field-error" role="alert">{fields.tags}</span>}
        </label>
      </fieldset>
      <div className="dash-savebar">
        <button type="submit" className="btn-primary" disabled={busy}>{busy ? "Adding…" : "Add file"}</button>
        <p className="dash-savebar-status" role="status">
          {!busy && outcome.error && <span className="dash-error">{outcome.error}</span>}
        </p>
      </div>
    </form>
  );
}
