import { useState } from "react";
import { motion } from "motion/react";
import { MagnifyingGlass } from "@phosphor-icons/react/dist/csr/MagnifyingGlass";
import { PlayCircle } from "@phosphor-icons/react/dist/csr/PlayCircle";
import Notice from "../components/Notice.jsx";
import { filterMessages } from "../lib/content.js";
import { useResource } from "../lib/useResource.js";
import { messageResource, messagesResource, sermonsResource } from "../lib/resources.js";
import { appStore } from "../lib/appStore.js";
import SavedNote from "../components/SavedNote.jsx";
import { SPRING_SNAPPY } from "../lib/motion.js";
import HeartButton from "../components/HeartButton.jsx";
import { isFaved, sermonFavItem } from "../lib/favourites.js";

const dayLabel = (iso) =>
  new Date(`${String(iso).slice(0, 10)}T12:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

const SUBTABS = [
  { id: "sermons", label: "Sermons" },
  { id: "messages", label: "Daily messages" },
];

function SubTabs({ value, onChange }) {
  return (
    <div className="segmented subtabs" role="tablist" aria-label="Sermons or daily messages">
      {SUBTABS.map(({ id, label }) => {
        const on = value === id;
        return (
          <button key={id} type="button" role="tab" aria-selected={on} className="segment"
            onClick={() => onChange(id)}>
            {on && <motion.span layoutId="subtab-pill" className="segment-pill" transition={SPRING_SNAPPY} />}
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
}

function SermonRow({ sermon, onOpen, faved, onToggleFav }) {
  return (
    <li className="sermon-row-wrap">
      <button type="button" className="list-row sermon-row" onClick={() => onOpen(sermon)}>
        <span className="grow">
          <motion.span layoutId={`sermon-title-${sermon.video_id}`} className="t-body block">
            {sermon.is_live && <span className="live-badge">Live</span>}
            {sermon.title}
          </motion.span>
          <span className="t-caption block">
            {dayLabel(sermon.preached_at)}
            {sermon.reference_verse ? ` · ${sermon.reference_verse}` : ""}
            {sermon.duration ? ` · ${sermon.duration.replace("PT", "").replace("H", "h ").replace("M", "m").replace("S", "s")}` : ""}
          </span>
        </span>
        <PlayCircle size={22} className="chev" />
      </button>
      <HeartButton active={faved} onToggle={onToggleFav} label="Save this sermon" />
    </li>
  );
}

function MessageRow({ row, onOpen }) {
  return (
    <li>
      <button type="button" className="list-row" onClick={() => onOpen(row)}>
        <span className="grow">
          <span className="t-body block">{row.title}</span>
          <span className="t-caption block">{dayLabel(row.date)}{row.reference_verse ? ` · ${row.reference_verse}` : ""}</span>
        </span>
      </button>
    </li>
  );
}

export default function SermonsTab({ profile, onOpenProfile, onOpenSermon, onOpenMessage, favs, onToggleFav }) {
  const branchSlug = profile?.branchSlug ?? "";
  const [tab, setTab] = useState("sermons");
  const [q, setQ] = useState("");
  const sermons = useResource(branchSlug ? sermonsResource(branchSlug) : null);
  const messages = useResource(branchSlug ? messagesResource(branchSlug) : null);

  const openMessage = async (row) => {
    const entry = await appStore.load(messageResource(branchSlug, row.id));
    onOpenMessage(entry.data ?? { ...row, message: "" });
  };

  if (!branchSlug) {
    return (
      <>
        <header className="screen-intro"><h1 className="t-display">Sermons</h1></header>
        <Notice kind="info" action={
          <button type="button" className="button button-primary notice-action" onClick={onOpenProfile}>Choose your branch</button>
        }>
          Choose your branch and the app will show your branch's sermons and daily messages.
        </Notice>
      </>
    );
  }

  const sermonRows = sermons.data?.sermons ?? [];
  const messageRows = filterMessages(messages.data?.messages ?? [], q);
  const loading = (sermons.status === "loading" && !sermons.data) || (messages.status === "loading" && !messages.data);

  return (
    <>
      <header className="screen-intro">
        <h1 className="t-display">Sermons</h1>
        <p className="t-callout screen-lede">Watch again, and read past daily messages.</p>
      </header>
      <SubTabs value={tab} onChange={setTab} />

      {tab === "sermons" && (
        <>
          <SavedNote entry={sermons} onRetry={sermons.refresh} />
          {loading && <div className="card home-card skeleton sk-card" aria-hidden="true" />}
          {!loading && sermonRows.length === 0 && (
            <div className="card empty-card">
              <p className="t-callout">{sermons.source === "offline" ? "No internet right now, and no sermons saved yet." : "No sermons yet. They appear here when your branch's YouTube channel is synced."}</p>
            </div>
          )}
          {!loading && sermonRows.length > 0 && (
            <ul className="list sermon-list">
              {sermonRows.map((s, i) => (
                <motion.li key={s.video_id || s.title} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ ...SPRING_SNAPPY, delay: Math.min(i * 0.04, 0.3) }}>
                  <SermonRow sermon={s} onOpen={onOpenSermon}
                    faved={isFaved(favs, "sermons", s.video_id)} onToggleFav={() => onToggleFav("sermons", sermonFavItem(s))} />
                </motion.li>
              ))}
            </ul>
          )}
        </>
      )}

      {tab === "messages" && (
        <>
          <label className="field search-field">
            <span className="search-box">
              <MagnifyingGlass size={18} aria-hidden="true" />
              <input className="input search-input" type="search" placeholder="Search the messages"
                value={q} onChange={(event) => setQ(event.target.value)} aria-label="Search daily messages" />
            </span>
          </label>
          <SavedNote entry={messages} onRetry={messages.refresh} />
          {loading && <div className="card home-card skeleton sk-card" aria-hidden="true" />}
          {!loading && messageRows.length === 0 && (
            <div className="card empty-card">
              <p className="t-callout">{q ? `No messages match “${q.trim()}”.` : "No daily messages yet. They appear here once your minister publishes them."}</p>
            </div>
          )}
          {!loading && messageRows.length > 0 && (
            <ul className="list">
              {messageRows.map((row) => <MessageRow key={row.id} row={row} onOpen={openMessage} />)}
            </ul>
          )}
        </>
      )}
    </>
  );
}
