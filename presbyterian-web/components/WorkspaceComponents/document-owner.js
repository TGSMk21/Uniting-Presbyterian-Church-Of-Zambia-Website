"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, X } from "lucide-react";
import PersonPicker from "./person-picker";
import { useConfirm } from "@/components/DashboardComponents/confirm-dialog";
import { deleteDocument, newVersion, renameDocument, restoreVersion, shareDocument, shareOptions }
  from "@/app/dashboard/workspace-actions";
import { groupChoices } from "@/Utilities/documents.mjs";

function useRun() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState(null);
  const run = (work, after) => start(async () => {
    const result = await work();
    if (result?.signedOut) return window.location.assign("/dashboard/login");
    setError(result?.error ?? null);
    if (result?.ok) {
      after?.();
      router.refresh();
    }
  });
  return { pending, error, run };
}

// Who can see it (R3): chips for each share, and ways to add one.
export function SharePanel({ document, startOpen = false }) {
  const { pending, error, run } = useRun();
  const [adding, setAdding] = useState(startOpen);
  const [options, setOptions] = useState(null);
  const [finding, setFinding] = useState(false);
  const share = (target) => run(() => shareDocument(document.id, { add: [target] }));

  useEffect(() => {
    if (!adding || options) return;
    let live = true;
    shareOptions().then((result) => {
      if (live) setOptions(result.options ?? { meetings: [] });
    });
    return () => {
      live = false;
    };
  }, [adding, options]);

  const have = new Set(document.shares.map((s) => s.label));
  const groups = groupChoices(options).filter((g) => !have.has(g.label));

  return (
    <section className="ws-panel" aria-labelledby="ws-share">
      <h2 id="ws-share" className="dash-subheading">Who can see it</h2>
      {document.shares.length ? (
        <ul className="ws-chosen ws-shares">
          {document.shares.map((s) => (
            <li key={s.id}>
              <span>{s.label}</span>
              <button type="button" className="ws-chip-remove" aria-label={`Stop sharing with ${s.label}`} disabled={pending}
                onClick={() => run(() => shareDocument(document.id, { remove: [s.id] }))}>
                <X size={14} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="dash-help">Only you, for now.</p>
      )}

      {adding ? (
        <div className="ws-share-add">
          {options === null ? <p className="dash-help">Loading…</p> : (
            <>
              {groups.length > 0 && (
                <div className="ws-groups" role="group" aria-label="Share with a group">
                  {groups.map((g) => (
                    <button key={g.label} type="button" className="ws-group" disabled={pending} onClick={() => share(g.target)}>
                      <Plus size={14} aria-hidden="true" /> {g.label}
                    </button>
                  ))}
                </div>
              )}
              {options.meetings?.length > 0 && (
                <label className="dash-field">
                  <span>The people at a meeting</span>
                  <select defaultValue="" disabled={pending}
                    onChange={(event) => event.target.value && share({ kind: "meeting", meeting: Number(event.target.value) })}>
                    <option value="">Choose a meeting</option>
                    {options.meetings.map((m) => <option key={m.id} value={m.id}>{m.title}, {m.when}</option>)}
                  </select>
                </label>
              )}
              {finding ? (
                <PersonPicker label="Find someone to share with" autoFocus onPick={(person) => share({ kind: "person", person: person.id })} />
              ) : (
                <button type="button" className="dash-quiet-button" onClick={() => setFinding(true)}>One person, by name</button>
              )}
              <div className="ws-actions">
                <button type="button" className="btn-ghost" onClick={() => { setAdding(false); setFinding(false); }}>Done</button>
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="ws-actions">
          <button type="button" className="btn-primary" onClick={() => setAdding(true)}>Share</button>
        </div>
      )}
      {error && <p className="dash-error" role="alert">{error}</p>}
    </section>
  );
}

// A new version: a new file for uploads; written documents are changed on the edit page.
export function NewVersion({ document }) {
  const [state, action, pending] = useActionState(newVersion.bind(null, document.id), {});
  const [open, setOpen] = useState(false);
  if (document.kind === "written") {
    return <Link href={`/dashboard/documents/${document.id}/edit`} className="btn-ghost">Change the words</Link>;
  }
  if (!open) return <button type="button" className="btn-ghost" onClick={() => setOpen(true)}>Upload a new version</button>;
  return (
    <form action={action} className="ws-note-step ws-new-version">
      <input type="hidden" name="mode" value="file" />
      <label className="dash-field"><span>The changed file</span><input name="file" type="file" required /></label>
      <label className="dash-field"><span>What changed <span className="dash-optional">optional</span></span>
        <input name="note" type="text" maxLength={300} placeholder="e.g. Corrected the totals" />
      </label>
      {state.error && <p className="dash-error" role="alert">{state.error}</p>}
      <div className="ws-actions">
        <button type="submit" className="btn-primary" disabled={pending}>{pending ? "Uploading…" : "Upload"}</button>
        <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>Back</button>
      </div>
      <p className="dash-help">Everyone it&apos;s shared with sees the new version. Older ones stay below.</p>
    </form>
  );
}

// Versions, newest first, each viewable; older ones can be brought back.
export function Versions({ document, showing, owner }) {
  const { pending, error, run } = useRun();
  const [confirm, dialog] = useConfirm();
  const newest = document.versions[0]?.number;
  const bringBack = async (number) => {
    const yes = await confirm({ title: `Bring back version ${number}?`,
      message: "It becomes the newest version. Nothing is lost: the current one stays in the list.",
      confirmLabel: "Bring it back" });
    if (yes) run(() => restoreVersion(document.id, number));
  };
  return (
    <section className="ws-panel" aria-labelledby="ws-versions">
      <h2 id="ws-versions" className="dash-subheading">Versions</h2>
      <ol className="ws-people ws-versions">
        {document.versions.map((v) => (
          <li key={v.number}>
            <span className="ws-person">
              <span className="ws-person-name">
                Version {v.number}{v.number === newest ? " · newest" : ""}{v.number === showing ? " · showing" : ""}
              </span>
              <span className="ws-person-meta">
                {[v.author, new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric",
                  timeZone: "Africa/Lusaka" }).format(new Date(v.created_at)), v.note].filter(Boolean).join(" · ")}
              </span>
            </span>
            {v.number !== showing && (
              <Link className="dash-link" href={`/dashboard/documents/${document.id}${v.number === newest ? "" : `?version=${v.number}`}`}>
                View
              </Link>
            )}
            {owner && v.number !== newest && (
              <button type="button" className="dash-quiet-button" disabled={pending} onClick={() => bringBack(v.number)}>
                Bring back
              </button>
            )}
          </li>
        ))}
      </ol>
      {error && <p className="dash-error" role="alert">{error}</p>}
      {dialog}
    </section>
  );
}

export function Viewers({ viewers, newest }) {
  return (
    <section className="ws-panel" aria-labelledby="ws-viewers">
      <h2 id="ws-viewers" className="dash-subheading">Who has opened it</h2>
      {viewers.length ? (
        <ul className="ws-people">
          {viewers.map((v) => (
            <li key={v.name}>
              <span className="ws-person-name">{v.name}</span>
              <span className="ws-person-meta">{v.version === newest ? "Newest version" : `Version ${v.version}`}</span>
            </li>
          ))}
        </ul>
      ) : <p className="dash-help">Nobody yet.</p>}
    </section>
  );
}

// Rename or delete, tucked away: these are rarely needed.
export function DocumentSettings({ document }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(renameDocument.bind(null, document.id), {});
  const [confirm, dialog] = useConfirm();
  const [deleting, start] = useTransition();
  const [error, setError] = useState(null);
  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state, router]);
  const remove = async () => {
    const yes = await confirm({ title: `Delete “${document.title}”?`,
      message: "It and all its versions are removed for everyone it's shared with. This can't be undone.",
      confirmLabel: "Delete", danger: true });
    if (yes) start(async () => setError((await deleteDocument(document.id))?.error ?? null));
  };
  return (
    <details className="ws-panel ws-settings">
      <summary>Name and settings</summary>
      <form action={action} className="dash-form">
        <label className="dash-field"><span>Name</span>
          <input name="title" type="text" required maxLength={200} defaultValue={document.title} />
        </label>
        <label className="dash-field"><span>About it <span className="dash-optional">optional</span></span>
          <input name="description" type="text" maxLength={1000} defaultValue={document.description} />
        </label>
        {state.error && <p className="dash-error" role="alert">{state.error}</p>}
        <div className="ws-actions">
          <button type="submit" className="btn-ghost" disabled={pending}>{pending ? "Saving…" : "Save"}</button>
          {state.ok && <span className="ws-saved" role="status">Saved.</span>}
          <button type="button" className="dash-danger-button" onClick={remove} disabled={deleting}>Delete document</button>
        </div>
        {error && <p className="dash-error" role="alert">{error}</p>}
      </form>
      {dialog}
    </details>
  );
}
