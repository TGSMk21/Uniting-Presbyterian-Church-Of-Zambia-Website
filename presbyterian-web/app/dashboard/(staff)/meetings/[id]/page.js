import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Clock, FileText, MapPin, Video } from "lucide-react";
import { Attendees, ManageMeeting, MyAnswer } from "@/components/WorkspaceComponents/meeting-panel";
import DeliverablePanel from "@/components/WorkspaceComponents/deliverable-panel";
import { meetingWhen } from "@/Utilities/meetings.mjs";
import { isRowId } from "@/Utilities/workspace.mjs";
import { requireStaff, staffRequest } from "../../../session";

function placeValue(meeting) {
  if (meeting.level === "synod") return "synod";
  if (meeting.level === "presbytery") return meeting.presbytery ? `presbytery:${meeting.presbytery.slug}` : "";
  return meeting.branch ? `branch:${meeting.branch.slug}` : "";
}

const NOTICES = {
  planned: "Meeting planned. Everyone invited has been told.",
  saved: "Changes saved.",
  shared: "The document is shared with everyone at this meeting.",
};

export default async function MeetingPage({ params, searchParams }) {
  const staff = await requireStaff();
  const { id } = await params;
  if (!staff.workspace_member || !isRowId(id)) notFound();
  const { status, data: meeting } = await staffRequest(`/workspace/meetings/${id}/`);
  if (status === 401) redirect("/dashboard/login");
  if (status === 404 || status === 403) notFound();
  if (status !== 200) throw new Error("The workspace API didn't answer");
  let templates = [];
  if (meeting.can_manage && meeting.deliverables.length === 0) {
    const answer = await staffRequest(`/workspace/templates/?level=${meeting.level}`);
    if (answer.status === 200) templates = answer.data;
  }
  const query = await searchParams;
  const notice = Object.keys(NOTICES).find((key) => query[key] === "1");
  const invited = meeting.my_response !== null;

  return (
    <main className="dash-main">
      <Link href="/dashboard/meetings" className="dash-link">Meetings</Link>
      {notice && <p className="dash-notice" role="status">{NOTICES[notice]}</p>}

      <header className="ws-meeting-head">
        <p className="ws-level-label">{meeting.place_title}</p>
        <h1 className="dash-heading">{meeting.title}</h1>
        {meeting.status === "cancelled" && <p className="dash-notice dash-notice-warning">This meeting was cancelled.</p>}
        <ul className="ws-facts">
          <li><Clock size={16} aria-hidden="true" /> {meetingWhen(meeting)}</li>
          {meeting.venue && <li><MapPin size={16} aria-hidden="true" /> {meeting.venue}</li>}
          {meeting.online_link && (
            <li>
              <Video size={16} aria-hidden="true" />{" "}
              <a href={meeting.online_link} target="_blank" rel="noopener noreferrer" className="dash-link">Join the video call</a>
            </li>
          )}
        </ul>
        {meeting.organiser && <p className="dash-help">Planned by {meeting.organiser.name}</p>}
      </header>

      {invited && meeting.status === "scheduled" && !meeting.has_started && !meeting.is_organiser && (
        <MyAnswer meeting={meeting} />
      )}

      {meeting.can_manage && <ManageMeeting meeting={meeting} />}

      <div className="ws-meeting-grid">
        <DeliverablePanel meeting={meeting} templates={templates} />
        <section className="ws-panel" aria-labelledby="ws-agenda">
          <h2 id="ws-agenda" className="dash-subheading">Agenda</h2>
          {meeting.agenda ? <p className="dash-prewrap">{meeting.agenda}</p> :
            <p className="dash-help">No agenda yet.{meeting.can_manage && meeting.status === "scheduled" ? " Add one under Change details." : ""}</p>}
        </section>
        <Attendees meeting={meeting} place={placeValue(meeting)} />
        <section className="ws-panel ws-meeting-docs" aria-labelledby="ws-docs">
          <h2 id="ws-docs" className="dash-subheading">Documents</h2>
          {meeting.documents.length ? (
            <ul className="ws-people">
              {meeting.documents.map((d) => (
                <li key={d.id}>
                  <FileText size={16} aria-hidden="true" className="ws-muted" />
                  <Link href={`/dashboard/documents/${d.id}`} className="ws-person">
                    <span className="ws-person-name">{d.title}</span>
                    <span className="ws-person-meta">{d.owner}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : <p className="dash-help">No documents shared with this meeting yet.</p>}
          {meeting.status !== "cancelled" && (
            <div className="ws-actions">
              <Link href={`/dashboard/documents/new?meeting=${meeting.id}`} className="btn-ghost">Share a document</Link>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
