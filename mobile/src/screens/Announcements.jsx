import { motion } from "motion/react";
import Notice from "../components/Notice.jsx";
import { SPRING_SNAPPY } from "../lib/motion.js";
import { PushPin } from "@phosphor-icons/react/dist/csr/PushPin";
import { CaretRight } from "@phosphor-icons/react/dist/csr/CaretRight";
import { sortAnnouncements } from "../lib/announcements.js";
import { unreadOf } from "../lib/marks.js";

export function AnnouncementBody({ announcement }) {
  const paragraphs = String(announcement.body ?? "").split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  return (
    <>
      <p className="t-caption sheet-para">
        {announcement.is_pinned ? "Pinned · " : ""}
        {new Date(`${String(announcement.starts_on).slice(0, 10)}T12:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
      </p>
      {paragraphs.map((p, i) => (
        <p key={i} className="t-body sheet-para">{p}</p>
      ))}
    </>
  );
}

export default function AnnouncementsTab({ profile, onOpenProfile, data, status, source, readMarks, onOpenAnnouncement }) {
  if (!profile?.branchSlug) {
    return (
      <>
        <header className="screen-intro"><h1 className="t-display">Announcements</h1></header>
        <Notice kind="info" action={
          <button type="button" className="button button-primary notice-action" onClick={onOpenProfile}>Choose your branch</button>
        }>
          Choose your branch and the app will show your branch's announcements.
        </Notice>
      </>
    );
  }

  const rows = sortAnnouncements(data?.announcements ?? []);
  const unread = new Set(unreadOf(rows, readMarks).map((a) => String(a.id)));
  const loading = status === "loading" && !data;

  return (
    <>
      <header className="screen-intro">
        <h1 className="t-display">Announcements</h1>
        <p className="t-callout screen-lede">News from your branch.</p>
      </header>
      {source === "cache" && <p className="t-caption offline-note">You're offline — showing what was saved on this phone.</p>}
      {loading && <div className="card home-card skeleton sk-card" aria-hidden="true" />}
      {!loading && rows.length === 0 && (
        <div className="card empty-card">
          <p className="t-callout">{source === "offline" ? "No internet right now, and no announcements saved yet." : "No announcements right now. News from your branch appears here when it's posted."}</p>
        </div>
      )}
      {!loading && rows.length > 0 && (
        <ul className="list">
          {rows.map((a, i) => (
            <motion.li key={a.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              transition={{ ...SPRING_SNAPPY, delay: Math.min(i * 0.04, 0.3) }}>
              <button type="button" className="list-row" onClick={() => onOpenAnnouncement(a)}>
                <span className="grow">
                  <motion.span layoutId={`announcement-title-${a.id}`} className="t-body block">
                    {a.is_pinned && <PushPin size={14} className="pin-icon" aria-label="Pinned" />}
                    {unread.has(String(a.id)) && <span className="new-badge">New</span>}
                    {a.title}
                  </motion.span>
                  <span className="t-caption block">{new Date(`${String(a.starts_on).slice(0, 10)}T12:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "long" })}</span>
                </span>
                <CaretRight size={18} className="chev" />
              </button>
            </motion.li>
          ))}
        </ul>
      )}
    </>
  );
}
