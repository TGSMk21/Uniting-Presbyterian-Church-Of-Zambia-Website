import { useMemo, useState } from "react";
import { Check } from "@phosphor-icons/react/dist/csr/Check";
import Notice from "./Notice.jsx";

export function filterBranches(branches, query) {
  const q = query.trim().toLowerCase();
  if (!q) return branches;
  return branches.filter((b) => b.name.toLowerCase().includes(q) || b.slug.includes(q));
}

export default function BranchPicker({ status, branches, source, onRetry, value, onChange }) {
  const [query, setQuery] = useState("");
  const shown = useMemo(() => filterBranches(branches, query), [branches, query]);

  return (
    <div className="branch-picker">
      <label className="field">
        <span className="field-label">Your branch</span>
        <input
          className="input"
          type="search"
          placeholder="Search for your congregation"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          autoComplete="off"
        />
      </label>
      {status === "loading" && (
        <div className="branch-list" aria-label="Loading the list of branches">
          {[0, 1, 2, 3].map((i) => <div key={i} className="branch-row skeleton" aria-hidden="true" />)}
        </div>
      )}
      {status === "ready" && source !== "api" && (
        <Notice kind={source === "fallback" ? "offline" : "info"} action={
          <button type="button" className="button button-quiet notice-action" onClick={onRetry}>Try again</button>
        }>
          {source === "fallback"
            ? "No internet right now, so this is the list saved with the app."
            : "Showing the list saved on this phone. A newer list will load when you're online."}
        </Notice>
      )}
      {status === "ready" && shown.length === 0 && (
        <p className="t-callout picker-empty">No congregation matches “{query.trim()}”. Check the spelling, or choose Skip for now and set it later in your profile.</p>
      )}
      {status === "ready" && shown.length > 0 && (
        <ul className="branch-list" role="radiogroup" aria-label="Branches">
          {shown.map((branch) => {
            const on = branch.slug === value;
            return (
              <li key={branch.slug}>
                <button type="button" role="radio" aria-checked={on} className="branch-row"
                  onClick={() => onChange(branch.slug)}>
                  <span className="grow t-body">{branch.name}</span>
                  {on && <Check size={20} weight="bold" className="chev" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
