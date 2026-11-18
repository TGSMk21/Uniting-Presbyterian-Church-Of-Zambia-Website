import Notice from "../components/Notice.jsx";
import HomeTab from "./Home.jsx";

export { HomeTab };

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

function NoBranch({ what, onChoose }) {
  return (
    <Notice kind="info" action={
      <button type="button" className="button button-primary notice-action" onClick={onChoose}>Choose your branch</button>
    }>
      Choose your branch and the app will show {what}.
    </Notice>
  );
}

export function EventsTab({ profile, onOpenProfile }) {
  return (
    <>
      <Intro title="Events">What's happening at your branch, newest first.</Intro>
      {!profile?.branchSlug
        ? <NoBranch what="your branch's events and reminders" onChoose={onOpenProfile} />
        : <Coming lines={["Upcoming and past events", "Details and photos in one tap", "Add to your calendar, with reminders"]} />}
    </>
  );
}

export function SermonsTab({ profile, onOpenProfile }) {
  return (
    <>
      <Intro title="Sermons">Watch again, and read past daily messages.</Intro>
      {!profile?.branchSlug
        ? <NoBranch what="your branch's sermons and daily messages" onChoose={onOpenProfile} />
        : <Coming lines={["Sermon videos from your branch", "The library of daily messages", "Live services, the moment they start"]} />}
    </>
  );
}

export function HymnsTab({ profile, onOpenProfile }) {
  return (
    <>
      <Intro title="Hymns">Sing along in Tumbuka, Chewa and English.</Intro>
      {!profile?.branchSlug
        ? <NoBranch what="the hymn books" onChoose={onOpenProfile} />
        : <Coming lines={["Tumbuka Hymns", "Chewa Hymns", "English Hymns"]} />}
    </>
  );
}

export function AnnouncementsTab({ profile, onOpenProfile }) {
  return (
    <>
      <Intro title="Announcements">News from your branch.</Intro>
      {!profile?.branchSlug
        ? <NoBranch what="your branch's announcements" onChoose={onOpenProfile} />
        : <Coming lines={["Pinned announcements first", "The full message in one tap"]} />}
    </>
  );
}
