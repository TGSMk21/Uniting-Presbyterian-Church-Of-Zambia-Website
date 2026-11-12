import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import MeetingForm from "@/components/WorkspaceComponents/meeting-form";
import { isRowId } from "@/Utilities/workspace.mjs";
import { requireStaff, staffRequest } from "../../../../session";

export default async function EditMeeting({ params }) {
  const staff = await requireStaff();
  const { id } = await params;
  if (!staff.workspace_member || !isRowId(id)) notFound();
  const { status, data } = await staffRequest(`/workspace/meetings/${id}/`);
  if (status === 401) redirect("/dashboard/login");
  if (status === 404 || status === 403) notFound();
  if (status !== 200) throw new Error("The workspace API didn't answer");
  if (!data.can_manage || data.status !== "scheduled") redirect(`/dashboard/meetings/${id}`);

  return (
    <main className="dash-main ws-narrow">
      <Link href={`/dashboard/meetings/${id}`} className="dash-link">{data.title}</Link>
      <h1 className="dash-heading">Change details</h1>
      <p className="dash-text">{data.place_title}</p>
      <MeetingForm places={[]} meeting={data} />
    </main>
  );
}
