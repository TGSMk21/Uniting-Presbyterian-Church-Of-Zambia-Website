import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import MeetingForm from "@/components/WorkspaceComponents/meeting-form";
import { placeOptions } from "@/Utilities/meetings.mjs";
import { requireStaff, staffRequest } from "../../../session";

export default async function PlanMeeting({ searchParams }) {
  const staff = await requireStaff();
  if (!staff.workspace_member) notFound();
  const { date } = await searchParams;
  const me = await staffRequest("/workspace/me/");
  if (me.status === 401) redirect("/dashboard/login");
  if (me.status !== 200) throw new Error("The workspace API didn't answer");
  const places = placeOptions(me.data.organise);
  if (!places.length) notFound();

  return (
    <main className="dash-main ws-narrow">
      <Link href="/dashboard/meetings" className="dash-link">Meetings</Link>
      <h1 className="dash-heading">Plan a meeting</h1>
      <MeetingForm places={places} defaultDate={/^\d{4}-\d{2}-\d{2}$/.test(date ?? "") ? date : ""} />
    </main>
  );
}
