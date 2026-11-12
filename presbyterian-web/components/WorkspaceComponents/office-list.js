"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserRound, X } from "lucide-react";
import { appointPerson, endAppointment } from "@/app/dashboard/workspace-actions";
import { useConfirm } from "@/components/DashboardComponents/confirm-dialog";
import { officeRows } from "@/Utilities/workspace.mjs";
import PersonPicker from "./person-picker";

// The offices at one place (Task 8.1): each position with its holder, or "Not appointed".
// `canAppoint` shows Appoint, Change and Remove; everyone else just reads.
export default function OfficeList({ positions, level, officeBearers, place = null, scope = {}, canAppoint = false }) {
  const router = useRouter();
  const [choosing, setChoosing] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [confirm, dialog] = useConfirm();
  const rows = officeRows(positions, level, officeBearers);

  async function appoint(position, person) {
    setBusy(true);
    setError(null);
    const result = await appointPerson({
      person: person.id, position: position.id,
      branch: level === "branch" ? place?.slug : null,
      presbytery: level === "presbytery" ? place?.slug : null,
    });
    setBusy(false);
    if (result.signedOut) return window.location.assign("/dashboard/login");
    if (result.error) return setError(result.error);
    setChoosing(null);
    router.refresh();
  }

  async function remove(row) {
    const sure = await confirm({
      title: `Remove ${row.holder.person.name} as ${row.position.name}?`,
      message: "They stop holding this office today. It stays in the records.",
      confirmLabel: "Remove", danger: true,
    });
    if (!sure) return;
    setBusy(true);
    setError(null);
    const result = await endAppointment(row.holder.id);
    setBusy(false);
    if (result.signedOut) return window.location.assign("/dashboard/login");
    if (result.error) return setError(result.error);
    router.refresh();
  }

  if (rows.length === 0) return <p className="dash-text">No positions at this level yet.</p>;

  return (
    <>
      <ul className="ws-offices">
        {rows.map((row) => (
          <li key={row.position.id} className="ws-office">
            <div className="ws-office-main">
              <span className="ws-office-title">{row.position.name}</span>
              {row.holder ? (
                <span className="ws-office-holder"><UserRound size={15} aria-hidden="true" /> {row.holder.person.name}</span>
              ) : (
                <span className="ws-office-vacant">Not appointed</span>
              )}
            </div>
            {canAppoint && choosing !== row.position.id && (
              <div className="ws-office-actions">
                <button type="button" className="dash-quiet-button" disabled={busy} onClick={() => setChoosing(row.position.id)}>
                  {row.holder ? "Change" : "Appoint"}
                </button>
                {row.holder && (
                  <button type="button" className="ws-icon-button" disabled={busy} onClick={() => remove(row)}
                    aria-label={`Remove ${row.holder.person.name} as ${row.position.name}`}>
                    <X size={16} aria-hidden="true" />
                  </button>
                )}
              </div>
            )}
            {canAppoint && choosing === row.position.id && (
              <div className="ws-office-choose">
                <p className="dash-text">Who is the {row.position.name}?</p>
                <PersonPicker scope={scope} exclude={row.holder ? [row.holder.person.id] : []} autoFocus
                  label={`Find the ${row.position.name}`} onPick={(person) => appoint(row.position, person)} />
                <button type="button" className="dash-link-button" onClick={() => setChoosing(null)}>Cancel</button>
              </div>
            )}
          </li>
        ))}
      </ul>
      {error && <p className="dash-error" role="alert">{error}</p>}
      {dialog}
    </>
  );
}
