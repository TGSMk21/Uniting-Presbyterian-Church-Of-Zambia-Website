// The five tabs (MOBILE_APP_PLAN.md, Phase 0). Placeholders for now: each says what's coming,
// in the layout the finished screen will use.
import { partOfDay } from "../lib/greeting.js";

function Intro({ overline, title, children }) {
  return (
    <header className="screen-intro">
      {overline && <p className="t-overline">{overline}</p>}
      <h1 className="t-display">{title}</h1>
      {children && <p className="t-callout screen-lede">{children}</p>}
    </header>
  );
}

function Coming({ lines }) {
  return (
    <ul className="coming" aria-label="Coming in the next updates">
      {lines.map((line) => (
        <li key={line} className="coming-row">
          <span className="coming-dot" aria-hidden="true" />
          <span className="t-callout">{line}</span>
        </li>
      ))}
    </ul>
  );
}

const today = () => new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long" }).format(new Date());

export function HomeTab() {
  return (
    <>
      <Intro overline={today()} title={`Good ${partOfDay(new Date())}.`} />
      <Coming lines={["Today's verse, set to be read slowly", "The daily message from your minister",
        "The latest sermons", "What's coming up at your branch"]} />
    </>
  );
}

export function EventsTab() {
  return (
    <>
      <Intro title="Events">What's happening at your branch, newest first.</Intro>
      <Coming lines={["Upcoming and past events", "Details and photos in one tap", "Add to your calendar, with reminders"]} />
    </>
  );
}

export function SermonsTab() {
  return (
    <>
      <Intro title="Sermons">Watch again, and read past daily messages.</Intro>
      <Coming lines={["Sermon videos from your branch", "The library of daily messages", "Live services, the moment they start"]} />
    </>
  );
}

export function HymnsTab() {
  return (
    <>
      <Intro title="Hymns">Sing along in Tumbuka, Chewa and English.</Intro>
      <Coming lines={["Tumbuka Hymns", "Chewa Hymns", "English Hymns"]} />
    </>
  );
}

export function AnnouncementsTab() {
  return (
    <>
      <Intro title="Announcements">News from your branch.</Intro>
      <Coming lines={["Pinned announcements first", "The full message in one tap"]} />
    </>
  );
}
