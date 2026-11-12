import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import WrittenEditor from "@/components/WorkspaceComponents/written-editor";
import { isRowId } from "@/Utilities/workspace.mjs";
import { requireStaff, staffRequest } from "../../../../session";

// Changing a document written in the hub: saving makes a new version (D8.8).
export default async function EditDocument({ params }) {
  const staff = await requireStaff();
  const { id } = await params;
  if (!staff.workspace_member || !isRowId(id)) notFound();
  const { status, data } = await staffRequest(`/workspace/documents/${id}/`);
  if (status === 401) redirect("/dashboard/login");
  if (status === 403 || status === 404) notFound();
  if (status !== 200) throw new Error("The workspace API didn't answer");
  if (!data.is_mine || data.kind !== "written") redirect(`/dashboard/documents/${id}`);
  return (
    <main className="dash-main ws-narrow">
      <Link href={`/dashboard/documents/${id}`} className="dash-link">{data.title}</Link>
      <h1 className="dash-heading">Change the words</h1>
      <WrittenEditor document={data} />
    </main>
  );
}
