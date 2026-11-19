import Notice from "../components/Notice.jsx";
import HomeTab from "./Home.jsx";
import SermonsTab from "./Sermons.jsx";
import EventsTab from "./Events.jsx";
import AnnouncementsTab from "./Announcements.jsx";
import HymnsTab from "./Hymns.jsx";

export { HomeTab, SermonsTab, EventsTab, AnnouncementsTab, HymnsTab };

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


