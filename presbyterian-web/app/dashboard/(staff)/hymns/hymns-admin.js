"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteHymn, importHymns, saveHymn } from "./hymns-actions";

const COLLECTIONS = [
  { value: "tumbuka", label: "Tumbuka Hymns" },
  { value: "chewa", label: "Chewa Hymns" },
  { value: "english", label: "English Hymns" },
];

const EMPTY = { id: "", collection: "tumbuka", number: "", title: "", verses: "", chorus: "", notes: "" };

export default function HymnsAdmin({ initialHymns }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [collection, setCollection] = useState("all");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState(EMPTY);
  const [formOpen, setFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importJson, setImportJson] = useState("");
  const [message, setMessage] = useState(null);

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return initialHymns
      .filter((h) => collection === "all" || h.collection === collection)
      .filter((h) => !needle || h.title.toLowerCase().includes(needle) || String(h.number).includes(needle))
      .sort((a, b) => a.collection.localeCompare(b.collection) || a.number - b.number);
  }, [initialHymns, collection, query]);

  function openNew() {
    setEditing({ ...EMPTY, collection: collection === "all" ? "tumbuka" : collection });
    setFormOpen(true);
    setMessage(null);
  }

  function openEdit(hymn) {
    setEditing({
      id: String(hymn.id),
      collection: hymn.collection,
      number: String(hymn.number),
      title: hymn.title,
      verses: (hymn.verses ?? []).join("\n\n"),
      chorus: hymn.chorus ?? "",
      notes: hymn.notes ?? "",
    });
    setFormOpen(true);
    setMessage(null);
  }

  function onSave(previousState, formData) {
    setMessage(null);
    startTransition(async () => {
      const result = await saveHymn(previousState, formData);
      setMessage(result);
      if (result.ok) {
        setFormOpen(false);
        router.refresh();
      }
    });
  }

  function onImport(previousState, formData) {
    setMessage(null);
    startTransition(async () => {
      const result = await importHymns(previousState, formData);
      setMessage(result);
      if (result.ok) {
        setImportJson("");
        router.refresh();
      }
    });
  }

  function onDelete(hymn) {
    if (!window.confirm(`Delete ${hymn.title}? This can't be undone.`)) return;
    startTransition(async () => {
      const result = await deleteHymn(hymn.id);
      setMessage(result);
      if (result.ok) router.refresh();
    });
  }

  return (
    <>
      <section className="dash-section">
        <div className="dash-media-filters">
          {[{ value: "all", label: "All" }, ...COLLECTIONS].map(({ value, label }) => (
            <button key={value} type="button" className={`dash-link${collection === value ? " dash-link-active" : ""}`}
              onClick={() => setCollection(value)}>
              {label}
            </button>
          ))}
          <input className="dash-input" type="search" placeholder="Search by title or number"
            value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Search hymns" />
          <button type="button" className="btn-primary" onClick={openNew}>New hymn</button>
          <button type="button" className="dash-quiet-button" onClick={() => setImportOpen((v) => !v)}>
            {importOpen ? "Close import" : "Bulk import"}
          </button>
        </div>
        {message && <p className={message.error ? "dash-error" : "dash-text"}>{message.error || message.ok}</p>}

        <ul className="dash-history">
          {rows.map((hymn) => (
            <li key={hymn.id} className="dash-history-what">
              <span className="dash-row-meta">
                {COLLECTIONS.find((c) => c.value === hymn.collection)?.label} {hymn.number} — {hymn.title}
                {` · ${(hymn.verses ?? []).length} verse${(hymn.verses ?? []).length === 1 ? "" : "s"}`}
              </span>
              <span>
                <button type="button" className="dash-link" onClick={() => openEdit(hymn)}>Edit</button>{" "}
                <button type="button" className="dash-delete" onClick={() => onDelete(hymn)} disabled={pending}>Delete</button>
              </span>
            </li>
          ))}
          {rows.length === 0 && <li className="dash-text">No hymns match.</li>}
        </ul>
      </section>

      {formOpen && (
        <section className="dash-panel dash-section">
          <h2 className="dash-subheading">{editing.id ? "Edit hymn" : "New hymn"}</h2>
          <form action={onSave} className="dash-form">
            <input type="hidden" name="id" value={editing.id} />
            <label className="dash-field">
              <span>Collection</span>
              <select name="collection" defaultValue={editing.collection}>
                {COLLECTIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </label>
            <label className="dash-field">
              <span>Number</span>
              <input name="number" type="number" min="1" required defaultValue={editing.number} />
            </label>
            <label className="dash-field">
              <span>Title</span>
              <input name="title" required defaultValue={editing.title} />
            </label>
            <label className="dash-field">
              <span>Verses, one per line (a blank line starts a new verse)</span>
              <textarea name="verses" rows={6} required defaultValue={editing.verses} />
            </label>
            <label className="dash-field">
              <span>Chorus <em className="dash-optional">optional</em></span>
              <textarea name="chorus" rows={2} defaultValue={editing.chorus} />
            </label>
            <label className="dash-field">
              <span>Notes <em className="dash-optional">optional, e.g. the year</em></span>
              <input name="notes" defaultValue={editing.notes} />
            </label>
            <div className="dash-savebar">
              <button type="submit" className="btn-primary" disabled={pending}>{pending ? "Saving…" : "Save"}</button>
              <button type="button" className="dash-quiet-button" onClick={() => setFormOpen(false)}>Cancel</button>
            </div>
          </form>
        </section>
      )}

      {importOpen && (
        <section className="dash-panel dash-section">
          <h2 className="dash-subheading">Bulk import</h2>
          <p className="dash-text">
            Paste a JSON array, one object per hymn: <code>{"{ \"collection\": \"english\", \"number\": 1, \"title\": \"…\", \"verses\": [\"…\"], \"chorus\": \"…\", \"notes\": \"…\" }"}</code>.
            Hymns are matched by collection and number — existing ones are updated, new ones added. If any row is
            invalid, nothing is applied.
          </p>
          <form action={onImport} className="dash-form">
            <label className="dash-field">
              <span>JSON</span>
              <textarea name="json" rows={10} value={importJson} onChange={(event) => setImportJson(event.target.value)}
                placeholder='[{"collection": "english", "number": 1, "title": "Amazing Grace", "verses": ["…"]}]' />
            </label>
            <div className="dash-savebar">
              <button type="submit" className="btn-primary" disabled={pending || !importJson.trim()}>
                {pending ? "Importing…" : "Import"}
              </button>
            </div>
          </form>
        </section>
      )}
    </>
  );
}
