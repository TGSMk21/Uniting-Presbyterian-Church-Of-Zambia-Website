import { notFound, redirect } from "next/navigation";
import ChecklistEditor from "@/components/WorkspaceComponents/checklist-editor";
import { levelLabel } from "@/Utilities/workspace.mjs";
import { requireStaff, staffRequest } from "../../session";

// The routine meetings' usual deliverables (Task 8.4). The superuser keeps them current;
// organisers pick one when planning a meeting.
export default async function Checklists() {
  const staff = await requireStaff();
  if (!staff.is_superuser) notFound();
  const [templates, structure] = await Promise.all([staffRequest("/workspace/templates/"),
    staffRequest("/workspace/structure/")]);
  if (templates.status === 401) redirect("/dashboard/login");
  if (templates.status !== 200 || structure.status !== 200) throw new Error("The workspace API didn't answer");

  return (
    <main className="dash-main ws-narrow">
      <header className="dash-page-head">
        <h1 className="dash-heading">Checklists</h1>
        <p className="dash-text">
          What is usually brought to each kind of meeting, and who prepares it. When a meeting is planned with a
          checklist, whoever holds each office is asked for their part.
        </p>
      </header>
      {templates.data.map((template) => (
        <section key={template.id} className="ws-panel ws-checklist" aria-label={template.name}>
          <p className="ws-level-label">{levelLabel(template.level)} meetings</p>
          <ChecklistEditor template={template}
            positions={structure.data.positions.filter((p) => p.level === template.level)} />
        </section>
      ))}
    </main>
  );
}
