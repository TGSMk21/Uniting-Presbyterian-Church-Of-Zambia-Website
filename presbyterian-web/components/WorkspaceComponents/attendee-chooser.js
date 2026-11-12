"use client";

import { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import PersonPicker from "./person-picker";
import { inviteGroups } from "@/app/dashboard/workspace-actions";
import { parsePlace } from "@/Utilities/meetings.mjs";

// Choosing who to invite (Task 8.3): ready-made groups in one tap ("Session Clerks in
// Munali"), or people found by name. `chosen` is a list of { id, name, branch }.
export default function AttendeeChooser({ place, chosen, onChange, fixed = [] }) {
  const [groups, setGroups] = useState([]);
  const [finding, setFinding] = useState(false);
  const where = parsePlace(place);

  useEffect(() => {
    let live = true;
    inviteGroups(place).then((result) => {
      if (live) setGroups(result.groups ?? []);
    });
    return () => {
      live = false;
    };
  }, [place]);

  const have = new Set([...chosen.map((p) => p.id), ...fixed]);
  const add = (people) => {
    const fresh = people.filter((person) => !have.has(person.id));
    if (fresh.length) onChange([...chosen, ...fresh]);
  };
  const scope = where?.branch ? { branch: where.branch } : where?.presbytery ? { presbytery: where.presbytery } : {};

  return (
    <div className="ws-invite">
      {groups.length > 0 && (
        <div className="ws-groups" role="group" aria-label="Invite a group">
          {groups.map((group) => {
            const missing = group.people.filter((person) => !have.has(person.id)).length;
            return (
              <button key={group.key} type="button" className="ws-group" disabled={missing === 0}
                onClick={() => add(group.people)}>
                <Plus size={14} aria-hidden="true" />
                {group.label}
                <span className="ws-group-count">{group.people.length}</span>
              </button>
            );
          })}
        </div>
      )}

      {chosen.length > 0 ? (
        <ul className="ws-chosen" aria-label="Invited">
          {chosen.map((person) => (
            <li key={person.id}>
              <span>{person.name}</span>
              <button type="button" className="ws-chip-remove" aria-label={`Remove ${person.name}`}
                onClick={() => onChange(chosen.filter((p) => p.id !== person.id))}>
                <X size={14} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="dash-help">Nobody chosen yet. Tap a group above, or find people by name.</p>
      )}

      {finding ? (
        <PersonPicker scope={scope} exclude={[...have]} label="Find someone to invite" autoFocus
          onPick={(person) => add([person])} />
      ) : (
        <button type="button" className="dash-quiet-button" onClick={() => setFinding(true)}>Find someone by name</button>
      )}
    </div>
  );
}
