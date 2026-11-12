"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { saveChecklist } from "@/app/dashboard/workspace-actions";

let nextKey = 0;
const line = (item = {}) => ({
  key: ++nextKey,
  title: item.title ?? "",
  who: item.for_minister ? "minister" : item.position ? String(item.position) : "",
  days_before: item.days_before ?? 7,
});

// One checklist's lines: what, who usually prepares it, and how many days before (Task 8.4).
export default function ChecklistEditor({ template, positions }) {
  const router = useRouter();
  const [name, setName] = useState(template.name);
  const [lines, setLines] = useState(() => template.items.map(line));
  const [message, setMessage] = useState(null);
  const [pending, start] = useTransition();
  const set = (key, field, value) => {
    setMessage(null);
    setLines((all) => all.map((l) => (l.key === key ? { ...l, [field]: value } : l)));
  };

  const save = () => start(async () => {
    const result = await saveChecklist(template.id, {
      name, items: lines.map((l) => ({ title: l.title, who: l.who, position: l.who === "minister" ? null : l.who,
        days_before: l.days_before })),
    });
    if (result.signedOut) return window.location.assign("/dashboard/login");
    setMessage(result.ok ? { ok: "Saved." } : { error: result.error });
    if (result.ok) router.refresh();
  });

  return (
    <div className="ws-checklist-editor">
      <label className="dash-field">
        <span>Name</span>
        <input type="text" value={name} maxLength={100} onChange={(event) => { setName(event.target.value); setMessage(null); }} />
      </label>
      <ol className="ws-lines">
        {lines.map((l, index) => (
          <li key={l.key}>
            <label className="dash-field ws-line-title">
              <span className={index ? "sr-only" : undefined}>To bring</span>
              <input type="text" value={l.title} maxLength={200} required placeholder="e.g. Financial report"
                onChange={(event) => set(l.key, "title", event.target.value)} />
            </label>
            <label className="dash-field ws-line-who">
              <span className={index ? "sr-only" : undefined}>Prepared by</span>
              <select value={l.who} onChange={(event) => set(l.key, "who", event.target.value)}>
                {template.level === "branch" && <option value="minister">Minister</option>}
                {positions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                <option value="">Chosen each time</option>
              </select>
            </label>
            <label className="dash-field ws-line-days">
              <span className={index ? "sr-only" : undefined}>Days before</span>
              <input type="number" min={0} max={90} value={l.days_before}
                onChange={(event) => set(l.key, "days_before", event.target.value)} />
            </label>
            <button type="button" className="ws-icon-button" aria-label={`Remove ${l.title || "this line"}`}
              onClick={() => setLines((all) => all.filter((x) => x.key !== l.key))}>
              <X size={16} aria-hidden="true" />
            </button>
          </li>
        ))}
      </ol>
      <div className="ws-actions">
        <button type="button" className="btn-ghost" onClick={() => setLines((all) => [...all, line()])}>
          <Plus size={16} aria-hidden="true" /> Add a line
        </button>
        <button type="button" className="btn-primary" onClick={save} disabled={pending}>{pending ? "Saving…" : "Save"}</button>
        {message?.ok && <span className="ws-saved" role="status">{message.ok}</span>}
      </div>
      {message?.error && <p className="dash-error" role="alert">{message.error}</p>}
    </div>
  );
}
