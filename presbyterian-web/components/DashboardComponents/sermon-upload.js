"use client";

import { useId, useRef, useState } from "react";
import Link from "next/link";
import { uploadWriting } from "@/app/dashboard/content-actions";
import { SERMON_ACCEPT, checkSermonFile, uploadSummary } from "@/Utilities/sermonWritings.mjs";

const TRY_AGAIN = "This file couldn't be added right now. Please try again in a moment.";

// Sends the chosen files one at a time, so one bad file doesn't stop the others
// and each stays under the website host's size limit.
export default function SermonUpload({ branch, ministers, listHref }) {
  const form = useRef(null);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState([]);
  const [problem, setProblem] = useState(null);
  const fileId = useId();
  const ministerId = useId();

  async function submit(event) {
    event.preventDefault();
    const typed = new FormData(form.current);
    // With nothing chosen, browsers still send an empty, nameless file.
    const files = typed.getAll("files").filter((file) => file instanceof File && file.name);
    if (files.length === 0) {
      setProblem("Please choose at least one file.");
      return;
    }
    setProblem(null);
    setBusy(true);
    const done = [];
    for (const file of files) {
      const before = checkSermonFile(file);
      if (before) {
        done.push({ name: file.name, ok: false, error: before });
        setResults([...done]);
        continue;
      }
      const one = new FormData();
      one.append("file", file, file.name);
      one.append("minister", String(typed.get("minister") ?? ""));
      let outcome;
      try {
        outcome = await uploadWriting(branch, one);
      } catch {
        outcome = { error: TRY_AGAIN };
      }
      if (outcome.signedOut) {
        window.location.assign("/dashboard/login");
        return;
      }
      done.push(outcome.id ? { name: file.name, ok: true, id: outcome.id, title: outcome.title } : { name: file.name, ok: false, error: outcome.error });
      setResults([...done]);
    }
    setBusy(false);
    form.current.reset();
  }

  return (
    <>
      <form ref={form} onSubmit={submit} className="dash-editor" noValidate>
        <fieldset className="dash-section">
          <legend>Sermon files</legend>
          <label className="dash-field" htmlFor={ministerId}>
            <span>Preached by</span>
            <select id={ministerId} name="minister" required defaultValue={ministers[0]?.value}>
              {ministers.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label className="dash-field" htmlFor={fileId}>
            <span>Files</span>
            <input id={fileId} type="file" name="files" accept={SERMON_ACCEPT} multiple required aria-invalid={problem ? true : undefined} />
            <small>
              Word (.docx), PDF or plain text (.txt) files, up to 4 MB each. Scanned pages can&apos;t be read: please use the
              typed file.
            </small>
            {problem && <span className="dash-field-error" role="alert">{problem}</span>}
          </label>
        </fieldset>
        <div className="dash-savebar">
          <button type="submit" className="btn-primary" disabled={busy}>{busy ? "Adding…" : "Add files"}</button>
          <Link href={listHref} className="dash-link" prefetch={false}>Back to the list</Link>
          <p className="dash-savebar-status" role="status">
            {!busy && results.length > 0 && uploadSummary(results)}
            {busy && `Added ${results.filter((r) => r.ok).length} so far…`}
          </p>
        </div>
      </form>
      {results.length > 0 && (
        <ul className="dash-rows" aria-label="Files">
          {results.map((result, index) => (
            <li key={`${index}-${result.name}`}>
              {result.ok ? (
                <Link href={`${listHref}/${result.id}`} prefetch={false}>
                  <span className="dash-row-title">{result.title}</span>
                  <span className="dash-row-meta">Added from {result.name}. Open it to check the words.</span>
                </Link>
              ) : (
                <div className="dash-row-failed">
                  <span className="dash-row-title">{result.name}</span>
                  <span className="dash-error">{result.error}</span>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
