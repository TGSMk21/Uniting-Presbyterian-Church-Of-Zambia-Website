import { useCallback, useEffect, useState } from "react";
import { motion } from "motion/react";
import { CalendarPlus } from "@phosphor-icons/react/dist/csr/CalendarPlus";
import { CaretLeft } from "@phosphor-icons/react/dist/csr/CaretLeft";
import { CaretRight } from "@phosphor-icons/react/dist/csr/CaretRight";
import { Check } from "@phosphor-icons/react/dist/csr/Check";
import { Clock } from "@phosphor-icons/react/dist/csr/Clock";
import { MapPin } from "@phosphor-icons/react/dist/csr/MapPin";
import Notice from "../components/Notice.jsx";
import { loadEvents, eventsOnDate, eventLabel, formatTime, monthGrid, dotsFor, sortRecentFirst, todayIso } from "../lib/events.js";
import { loadSermons } from "../lib/content.js";
import { useContentData } from "../lib/useContent.js";
import { getPrefs } from "../lib/storage.js";
import { readAdded, toggleAdded, addToPhoneCalendar, removeFromPhoneCalendar } from "../lib/calendarStore.js";
import { notificationPermission, scheduleEventReminders, cancelEventReminders, removeStaleReminders } from "../lib/reminders.js";
import { SPRING_SNAPPY } from "../lib/motion.js";

const VIEWS = [
  { id: "list", label: "List" },
  { id: "calendar", label: "Calendar" },
];

function ViewSwitch({ value, onChange }) {
  return (
    <div className="segmented subtabs" role="tablist" aria-label="List or calendar">
      {VIEWS.map(({ id, label }) => {
        const on = value === id;
        return (
          <button key={id} type="button" role="tab" aria-selected={on} className="segment" onClick={() => onChange(id)}>
            {on && <motion.span layoutId="view-pill" className="segment-pill" transition={SPRING_SNAPPY} />}
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function EventBody({ event }) {
  const [prefs] = useState(() => getPrefs());
  const [added, setAdded] = useState(false);
  const [remindersOn, setRemindersOn] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    readAdded(prefs).then((list) => setAdded(list.includes(String(event.id))));
  }, [prefs, event.id]);

  const toggle = async () => {
    setBusy(true);
    const wasAdded = added;
    const list = await toggleAdded(prefs, event.id);
    const nowAdded = list.includes(String(event.id));
    setAdded(nowAdded);
    if (!wasAdded && nowAdded) {
      await addToPhoneCalendar(event, prefs);
      const perm = await notificationPermission();
      setRemindersOn(perm === "granted" && (await scheduleEventReminders(event)));
    } else if (wasAdded && !nowAdded) {
      await removeFromPhoneCalendar(event, prefs);
      await cancelEventReminders(event.id);
      setRemindersOn(false);
    }
    setBusy(false);
  };

  const paragraphs = String(event.details ?? "").split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const when = `${eventLabel(event, todayIso())} · ${formatTime(event.start_time)}–${formatTime(event.end_time)}`;

  return (
    <>
      <p className="t-caption sheet-para">
        <Clock size={14} className="inline-icon" aria-hidden="true" /> {when}
        {event.location && <> · <MapPin size={14} className="inline-icon" aria-hidden="true" /> {event.location}</>}
      </p>
      {paragraphs.map((p, i) => (
        <p key={i} className="t-body sheet-para">{p}</p>
      ))}
      {event.photos?.length > 0 && (
        <div className="photo-row" aria-label="Photos">
          {event.photos.map((photo) => (
            <img key={photo.id} className="event-photo" src={photo.url} alt="" width={256} height={168} loading="lazy" />
          ))}
        </div>
      )}
      <button type="button" className={`button ${added ? "button-quiet" : "button-primary"} add-button`}
        onClick={toggle} disabled={busy}>
        {added ? <><Check size={18} weight="bold" /> Added — tap to remove</> : <><CalendarPlus size={18} /> Add to calendar</>}
      </button>
      <p className="t-caption setting-note">
        {added
          ? (remindersOn
            ? "Reminders are set: the evening before and the morning of the event."
            : "Saved to your calendar. Reminders are off — allow notifications in Settings to get them the day before and the morning of.")
          : "Adding it puts it in your phone's calendar and sets a reminder the evening before and the morning of. We'll ask your phone's permission first."}
      </p>
    </>
  );
}

function CalendarView({ events, sermons, added, onPickDay, day, onOpenEvent }) {
  const now = new Date();
  const [cursor, setCursor] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const weeks = monthGrid(cursor.y, cursor.m);
  const dots = dotsFor({ events, sermons, added });
  const monthName = new Date(cursor.y, cursor.m, 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  const dayEvents = eventsOnDate(events, day);
  const daySermons = sermons.filter((s) => String(s.preached_at ?? "").slice(0, 10) === day);
  const today = todayIso();

  return (
    <>
      <div className="cal-head">
        <button type="button" className="icon-button" aria-label="Previous month"
          onClick={() => setCursor((c) => ({ y: c.m === 0 ? c.y - 1 : c.y, m: (c.m + 11) % 12 }))}>
          <CaretLeft size={20} />
        </button>
        <span className="t-headline">{monthName}</span>
        <button type="button" className="icon-button" aria-label="Next month"
          onClick={() => setCursor((c) => ({ y: c.m === 11 ? c.y + 1 : c.y, m: (c.m + 1) % 12 }))}>
          <CaretRight size={20} />
        </button>
      </div>
      <div className="cal-weekdays" aria-hidden="true">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <span key={d} className="t-micro">{d}</span>)}
      </div>
      <div className="cal-grid" role="grid" aria-label={monthName}>
        {weeks.flat().map((cell) => {
          const dot = dots[cell.iso];
          const on = cell.iso === day;
          const isTodayCell = cell.iso === today;
          return (
            <button key={cell.iso} type="button" role="gridcell" aria-selected={on}
              aria-label={`${cell.iso}${dot ? ", has events" : ""}`}
              className={`cal-cell${cell.inMonth ? "" : " cal-out"}${on ? " cal-on" : ""}${isTodayCell ? " cal-today" : ""}`}
              onClick={() => onPickDay(cell.iso)}>
              <span className="cal-day">{cell.day}</span>
              {dot && (
                <span className="cal-dots" aria-hidden="true">
                  {dot.sermon && <span className="cal-dot cal-dot-sermon" />}
                  {dot.event && <span className={`cal-dot cal-dot-event${dot.added ? " cal-dot-added" : ""}`} />}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div className="cal-day-list">
        <h2 className="t-overline section-label">{new Date(`${day}T12:00:00`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}</h2>
        {dayEvents.length === 0 && daySermons.length === 0 && <p className="t-caption">Nothing this day.</p>}
        <ul className="list">
          {dayEvents.map((event) => (
            <li key={`e${event.id}`}>
              <button type="button" className="list-row" onClick={() => onOpenEvent(event)}>
                <span className="grow">
                  <span className="t-body block">{event.title}</span>
                  <span className="t-caption block">{formatTime(event.start_time)} · {event.location}{added.includes(String(event.id)) ? " · Added" : ""}</span>
                </span>
              </button>
            </li>
          ))}
          {daySermons.map((s) => (
            <li key={`s${s.video_id}`} className="cal-sermon">
              <div className="list-row static">
                <span className="grow">
                  <span className="t-body block">{s.title}</span>
                  <span className="t-caption block">Sermon{s.reference_verse ? ` · ${s.reference_verse}` : ""}</span>
                </span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}

export default function EventsTab({ profile, onOpenProfile, onOpenEvent }) {
  const branchSlug = profile?.branchSlug ?? "";
  const [view, setView] = useState("list");
  const [added, setAdded] = useState([]);
  const [day, setDay] = useState(() => todayIso());
  const [prefs] = useState(() => getPrefs());
  const loadEventsCb = useCallback((opts) => loadEvents(opts), []);
  const loadSermonsCb = useCallback((opts) => loadSermons(opts), []);
  const events = useContentData(loadEventsCb, branchSlug);
  const sermons = useContentData(loadSermonsCb, branchSlug);

  useEffect(() => {
    readAdded(prefs).then(setAdded);
  }, [prefs, branchSlug]);

  useEffect(() => {
    if (events.data?.events) removeStaleReminders(events.data.events.map((e) => e.id));
  }, [events.data]);

  if (!branchSlug) {
    return (
      <>
        <header className="screen-intro"><h1 className="t-display">Events</h1></header>
        <Notice kind="info" action={
          <button type="button" className="button button-primary notice-action" onClick={onOpenProfile}>Choose your branch</button>
        }>
          Choose your branch and the app will show your branch's events and reminders.
        </Notice>
      </>
    );
  }

  const rows = sortRecentFirst(events.data?.events ?? []);
  const loading = events.status === "loading" && !events.data;
  const today = todayIso();

  return (
    <>
      <header className="screen-intro">
        <h1 className="t-display">Events</h1>
        <p className="t-callout screen-lede">What's happening at your branch, newest first.</p>
      </header>
      <ViewSwitch value={view} onChange={setView} />

      {view === "list" && (
        <>
          {events.source === "cache" && <p className="t-caption offline-note">You're offline — showing what was saved on this phone.</p>}
          {loading && <div className="card home-card skeleton sk-card" aria-hidden="true" />}
          {!loading && rows.length === 0 && (
            <div className="card empty-card">
              <p className="t-callout">{events.source === "offline" ? "No internet right now, and no events saved yet." : "No events yet. They appear here when your branch adds them."}</p>
            </div>
          )}
          {!loading && rows.length > 0 && (
            <ul className="list">
              {rows.map((event) => (
                <li key={event.id}>
                  <button type="button" className="list-row" onClick={() => onOpenEvent(event)}>
                    <span className="grow">
                      <span className="t-body block">
                        {event.date === today && <span className="today-badge">Today</span>}
                        {event.title}
                      </span>
                      <span className="t-caption block">
                        {eventLabel(event, today)} · {formatTime(event.start_time)} · {event.location}
                        {added.includes(String(event.id)) ? " · Added" : ""}
                      </span>
                    </span>
                    <CaretRight size={18} className="chev" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {view === "calendar" && (
        <CalendarView
          events={events.data?.events ?? []}
          sermons={sermons.data?.sermons ?? []}
          added={added}
          day={day}
          onPickDay={setDay}
          onOpenEvent={onOpenEvent}
        />
      )}
    </>
  );
}
