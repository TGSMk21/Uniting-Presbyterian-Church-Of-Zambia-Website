import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import DocumentForm from "@/components/WorkspaceComponents/document-form";
import { isRowId } from "@/Utilities/workspace.mjs";
import { requireStaff, staffRequest } from "../../../session";

export default async function AddDocument({ searchParams }) {
  const staff = await requireStaff();
  if (!staff.workspace_member) notFound();
  const { meeting: meetingId } = await searchParams;
  let meeting = null;
  if (isRowId(meetingId)) {
    const { status, data } = await staffRequest(`/workspace/meetings/${meetingId}/`);
    if (status === 401) redirect("/dashboard/login");
    if (status === 200) meeting = { id: data.id, title: data.title };
  }
  return (
    <main className="dash-main ws-narrow">
      <Link href={meeting ? `/dashboard/meetings/${meeting.id}` : "/dashboard/documents"} className="dash-link">
        {meeting ? meeting.title : "Documents"}
      </Link>
      <h1 className="dash-heading">{meeting ? "Share a document with this meeting" : "Add a document"}</h1>
      <DocumentForm meeting={meeting} />
    </main>
  );
}
