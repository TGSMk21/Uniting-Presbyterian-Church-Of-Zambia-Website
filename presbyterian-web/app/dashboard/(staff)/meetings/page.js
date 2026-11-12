import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CalendarPlus } from "lucide-react";
import CalendarLink from "@/components/WorkspaceComponents/calendar-link";
import { RESPONSES, dayKey, groupByDay, meetingWhen, monthGrid, monthKey, monthRange, monthTitle, parseMonth,
  placeOptions, shiftMonth } from "@/Utilities/meetings.mjs";
import { requireStaff, staffRequest } from "../../session";

const VIEWS = [
  { value: "upcoming", label: "Coming up" },
  { value: "month", label: "Month" },
  { value: "past", label: "Past" },
];

function MeetingRow({ meeting }) {
  const upcoming = !meeting.has_started;
  return (
    <li>
      <Link href={`/dashboard/meetings/${meeting.id}`} className={meeting.status === "cancelled" ? "ws-cancelled" : undefined}>
        <span className="dash-row-title">{meeting.title}</span>
        <span className="dash-row-meta">
          <span>{meetingWhen(meeting)}</span>
          <span>{meeting.place_title}</span>
          {meeting.status === "cancelled" && <span className="dash-badge dash-badge-neutral">Cancelled</span>}
          {meeting.status !== "cancelled" && upcoming && meeting.my_response === "pending" && (
            <span className="dash-badge dash-badge-warning">Answer needed</span>
          )}
          {meeting.status !== "cancelled" && meeting.my_response && meeting.my_response !== "pending" && (
            <span className="ws-muted">{RESPONSES[meeting.my_response]}</span>
          )}
        </span>
      </Link>
    </li>
  );
}

function Agenda({ meetings, empty }) {
  const days = groupByDay(meetings);
  if (!days.length) return <div className="dash-empty"><p>{empty}</p></div>;
  return days.map((day) => (
    <section key={day.key} className="ws-day" aria-label={day.label}>
      <h2 className="ws-day-label">{day.label}</h2>
      <ul className="dash-rows">{day.meetings.map((m) => <MeetingRow key={m.id} meeting={m} />)}</ul>
    </section>
  ));
}

function Month({ month, meetings, today }) {
  const byDay = {};
  for (const meeting of meetings) (byDay[dayKey(meeting.starts_at)] ??= []).push(meeting);
  const step = (by) => `/dashboard/meetings?view=month&month=${monthKey(shiftMonth(month, by))}`;
  return (
    <>
      <div className="ws-month-head">
        <Link href={step(-1)} className="btn-ghost" aria-label="Previous month">‹</Link>
        <h2 className="dash-subheading">{monthTitle(month)}</h2>
        <Link href={step(1)} className="btn-ghost" aria-label="Next month">›</Link>
      </div>
      <table className="ws-month">
        <thead>
          <tr>{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <th key={d} scope="col">{d}</th>)}</tr>
        </thead>
        <tbody>
          {monthGrid(month).map((week) => (
            <tr key={week[0].key}>
              {week.map((day) => (
                <td key={day.key} className={[!day.inMonth && "ws-out", day.key === today && "ws-today"].filter(Boolean).join(" ") || undefined}>
                  <span className="ws-date">{day.day}</span>
                  {(byDay[day.key] || []).map((m) => (
                    <Link key={m.id} href={`/dashboard/meetings/${m.id}`}
                      className={`ws-chip${m.status === "cancelled" ? " ws-cancelled" : ""}`} title={m.title}>
                      {m.title}
                    </Link>
                  ))}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {/* On a phone the grid shows dots; the list underneath carries the detail. */}
      <div className="ws-month-list">
        <Agenda meetings={meetings} empty="No meetings this month." />
      </div>
    </>
  );
}

// The shared calendar (Task 8.3): the meetings you're invited to, and those you organise.
export default async function Meetings({ searchParams }) {
  const staff = await requireStaff();
  if (!staff.workspace_member) notFound();
  const params = await searchParams;
  const view = VIEWS.some((v) => v.value === params.view) ? params.view : "upcoming";
  const month = parseMonth(params.month);
  const query = view === "month" ? `from=${monthRange(month).from}&to=${monthRange(month).to}` : `when=${view}`;
  const [list, me] = await Promise.all([staffRequest(`/workspace/meetings/?${query}`), staffRequest("/workspace/me/")]);
  if (list.status === 401 || me.status === 401) redirect("/dashboard/login");
  if (list.status === 403) notFound();
  if (list.status !== 200 || me.status !== 200) throw new Error("The workspace API didn't answer");
  const meetings = list.data.results;
  const canPlan = placeOptions(me.data.organise).length > 0;

  return (
    <main className="dash-main">
      <header className="dash-page-head ws-page-head">
        <div>
          <h1 className="dash-heading">Meetings</h1>
          <p className="dash-text">Meetings at your branch, presbytery and the synod that you&apos;re part of.</p>
        </div>
        {canPlan && (
          <Link href="/dashboard/meetings/new" className="btn-primary">
            <CalendarPlus size={18} aria-hidden="true" /> Plan a meeting
          </Link>
        )}
      </header>

      <nav className="dash-tabs" aria-label="Show">
        {VIEWS.map((v) => (
          <Link key={v.value} href={`/dashboard/meetings?view=${v.value}`} aria-current={v.value === view ? "page" : undefined}>
            {v.label}
          </Link>
        ))}
      </nav>

      {view === "month" ? (
        <Month month={month} meetings={meetings} today={dayKey(new Date())} />
      ) : (
        <Agenda meetings={meetings} empty={view === "past" ? "No past meetings yet." :
          canPlan ? "Nothing planned yet. Plan a meeting and invite the people who should come." :
            "No meetings coming up. When you're invited to one, it appears here."} />
      )}

      <section className="ws-phone" aria-labelledby="ws-phone">
        <h2 id="ws-phone" className="ws-level-label">On your phone</h2>
        <CalendarLink />
      </section>
    </main>
  );
}
