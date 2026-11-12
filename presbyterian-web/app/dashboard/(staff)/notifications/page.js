import { notFound, redirect } from "next/navigation";
import { Bell, CalendarDays, CheckCircle2, ClipboardList, FileText } from "lucide-react";
import { openNotification, readAllNotifications } from "../../workspace-actions";
import { requireStaff, staffRequest } from "../../session";

const ICONS = {
  meeting_invited: CalendarDays, meeting_changed: CalendarDays, meeting_cancelled: CalendarDays,
  deliverable_assigned: ClipboardList, deliverable_submitted: ClipboardList, deliverable_reviewed: CheckCircle2,
  document_shared: FileText,
};

const when = (iso) => new Intl.DateTimeFormat("en-GB", {
  day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lusaka",
}).format(new Date(iso));

// Everything the shared workspace has told this person (Task 8.2), newest first.
export default async function Notifications() {
  const staff = await requireStaff();
  if (!staff.workspace_member) notFound();
  const { status, data } = await staffRequest("/workspace/notifications/");
  if (status === 401) redirect("/dashboard/login");
  if (status !== 200) throw new Error(`The workspace API answered ${status}`);

  return (
    <main className="dash-main">
      <h1 className="dash-heading">Notifications</h1>
      <div className="dash-toolbar ws-toolbar">
        <p className="dash-text">{data.unread ? `${data.unread} unread` : "You're up to date."}</p>
        {data.unread > 0 && (
          <form action={readAllNotifications}><button type="submit" className="dash-quiet-button">Mark all as read</button></form>
        )}
      </div>
      {data.results.length === 0 ? (
        <p className="dash-empty">Nothing yet. You&apos;ll be told here when you&apos;re added to a meeting, asked to prepare
          something, or sent a document.</p>
      ) : (
        <ul className="ws-notes">
          {data.results.map((note) => {
            const Icon = ICONS[note.kind] || Bell;
            return (
              <li key={note.id}>
                <form action={openNotification.bind(null, note.id, note.link)}>
                  <button type="submit" className="ws-note" data-unread={!note.read || undefined}>
                    <Icon size={18} strokeWidth={1.75} aria-hidden="true" />
                    <span className="ws-note-text">{note.text}</span>
                    <span className="ws-note-when">{when(note.created_at)}</span>
                    {!note.read && <span className="sr-only">(unread)</span>}
                  </button>
                </form>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
