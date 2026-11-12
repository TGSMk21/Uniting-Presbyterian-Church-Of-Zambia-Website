import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { deliverableState, dueText } from "@/Utilities/deliverables.mjs";
import { requireStaff, staffRequest } from "../../session";

const VIEWS = [
  { value: "mine", label: "Yours to prepare", query: "mine=1" },
  { value: "review", label: "Handed in to you", query: "review=1" },
];

// Everything someone must bring to meetings, and what's waiting for them to check (Task 8.4).
export default async function Deliverables({ searchParams }) {
  const staff = await requireStaff();
  if (!staff.workspace_member) notFound();
  const params = await searchParams;
  const view = VIEWS.find((v) => v.value === params.view) ?? VIEWS[0];
  const { status, data } = await staffRequest(`/workspace/deliverables/?${view.query}`);
  if (status === 401) redirect("/dashboard/login");
  if (status === 403) notFound();
  if (status !== 200) throw new Error("The workspace API didn't answer");

  return (
    <main className="dash-main">
      <header className="dash-page-head">
        <h1 className="dash-heading">Deliverables</h1>
        <p className="dash-text">Reports, minutes and anything else to bring to a meeting. Open one to hand it in.</p>
      </header>
      <nav className="dash-tabs" aria-label="Show">
        {VIEWS.map((v) => (
          <Link key={v.value} href={`/dashboard/deliverables?view=${v.value}`}
            aria-current={v.value === view.value ? "page" : undefined}>{v.label}</Link>
        ))}
      </nav>
      {data.length === 0 ? (
        <div className="dash-empty">
          <p>{view.value === "mine" ? "Nothing to prepare. When you're asked to bring something to a meeting, it appears here."
            : "Nothing waiting. When someone hands in work for a meeting you organise, it appears here."}</p>
        </div>
      ) : (
        <ul className="dash-rows">
          {data.map((row) => {
            const state = deliverableState(row);
            return (
              <li key={row.id}>
                <Link href={`/dashboard/meetings/${row.meeting.id}`}>
                  <span className="dash-row-title">{row.title}</span>
                  <span className="dash-row-meta">
                    <span>{row.meeting.title}</span>
                    <span>{view.value === "review" && row.assignee ? `From ${row.assignee.name}` : `Due ${dueText(row.due_on)}`}</span>
                    <span className={`dash-badge ${state.tone === "danger" ? "ws-badge-danger" : `dash-badge-${state.tone}`}`}>
                      {state.label}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
