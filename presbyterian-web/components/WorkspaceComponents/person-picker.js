"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Search } from "lucide-react";
import { searchPeople } from "@/app/dashboard/workspace-actions";

// Find a workspace member by typing part of their name (Phase 8). Used for appointing
// office bearers, inviting people to meetings and sharing documents. `scope` narrows
// the list to one branch or presbytery; `exclude` hides people already chosen.
export default function PersonPicker({ scope = {}, exclude = [], onPick, label = "Find a person", autoFocus = false }) {
  const [query, setQuery] = useState("");
  const [people, setPeople] = useState(null);
  const [error, setError] = useState(null);
  const id = useId();
  const latest = useRef(0);
  const { branch = "", presbytery = "" } = scope;

  useEffect(() => {
    const ticket = ++latest.current;
    const timer = setTimeout(async () => {
      const result = await searchPeople({ q: query, branch, presbytery });
      if (ticket !== latest.current) return;
      if (result.signedOut) return window.location.assign("/dashboard/login");
      setError(result.error ?? null);
      setPeople(result.people ?? []);
    }, query ? 250 : 0);
    return () => clearTimeout(timer);
  }, [query, branch, presbytery]);

  const shown = (people || []).filter((person) => !exclude.includes(person.id));

  return (
    <div className="ws-picker">
      <label className="ws-picker-search" htmlFor={id}>
        <Search size={16} aria-hidden="true" />
        <span className="sr-only">{label}</span>
        <input id={id} type="search" value={query} onChange={(event) => setQuery(event.target.value)}
          placeholder="Type a name" autoComplete="off" autoFocus={autoFocus} />
      </label>
      {error && <p className="dash-error" role="alert">{error}</p>}
      <ul className="ws-picker-list" aria-label="People" aria-busy={people === null}>
        {people !== null && shown.length === 0 && <li className="ws-picker-empty">Nobody found.</li>}
        {shown.map((person) => (
          <li key={person.id}>
            <button type="button" onClick={() => onPick(person)}>
              <span className="ws-picker-name">{person.name}</span>
              <span className="ws-picker-meta">
                {[person.branch?.name, ...(person.offices || [])].filter(Boolean).join(" · ")}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
