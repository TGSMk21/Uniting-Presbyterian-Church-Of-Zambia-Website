import { useCallback, useEffect, useState } from "react";
import { ArrowRight } from "@phosphor-icons/react/dist/csr/ArrowRight";
import { ArrowsClockwise } from "@phosphor-icons/react/dist/csr/ArrowsClockwise";
import { ShareNetwork } from "@phosphor-icons/react/dist/csr/ShareNetwork";
import Notice from "../components/Notice.jsx";
import { fillName, partOfDay, GREETINGS } from "../lib/greeting.js";
import { homeSlots, timeAgo } from "../lib/home.js";
import { shareText } from "../lib/share.js";
import { eventsOnDate, formatTime, loadEvents, pastEvents, todayIso } from "../lib/events.js";
import { useContentData } from "../lib/useContent.js";

const dayLabel = (iso) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });

function UpdatedRow({ fetchedAt, source, onRefresh, refreshing }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);
  return (
    <div className="updated-row">
      <span className="t-caption">
        {source === "cache" ? "Saved on this phone · " : ""}
        {fetchedAt ? `Updated ${timeAgo(fetchedAt, now)}` : "Not updated yet"}
      </span>
      <button type="button" className="icon-button refresh-button" onClick={onRefresh}
        aria-label="Refresh" disabled={refreshing}>
        <ArrowsClockwise size={18} className={refreshing ? "spin" : ""} />
      </button>
    </div>
  );
}

function ShareButton({ title, text }) {
  const [state, setState] = useState(null);
  const onShare = async () => {
    const result = await shareText({ title, text });
    if (result === "copied" || result === "shared") {
      setState(result === "copied" ? "Copied" : "Shared");
      setTimeout(() => setState(null), 2000);
    }
  };
  return (
    <button type="button" className="share-button" onClick={onShare}>
      <ShareNetwork size={18} />
      <span className="t-caption">{state ?? "Share"}</span>
    </button>
  );
}

function VerseCard({ verse }) {
  return (
    <section className="card home-card verse-card" aria-label="Today's verse">
      <p className="t-overline">Today's verse</p>
      <blockquote className="verse-text selectable">{verse.text}</blockquote>
      <div className="card-foot">
        <span className="t-caption verse-ref">{verse.ref}</span>
        <ShareButton title={verse.ref} text={`${verse.text} — ${verse.ref}`} />
      </div>
    </section>
  );
}

function TodayCard({ events, today, onOpen }) {
  const todays = eventsOnDate(events, today);
  if (!todays.length) return null;
  const first = todays[0];
  const more = todays.length - 1;
  return (
    <button type="button" className="card home-card today-card" onClick={() => onOpen(first)}>
      <p className="t-overline">Today</p>
      <span className="t-headline block">{first.title}{more > 0 ? ` (+${more} more)` : ""}</span>
      <span className="t-callout read-more">{formatTime(first.start_time)} · {first.location} <ArrowRight size={14} className="chev" /></span>
    </button>
  );
}

function LiveCard({ live, onOpen }) {
  return (
    <button type="button" className="card home-card live-card" onClick={() => onOpen(live)}>
      <p className="t-overline live-overline">Live now</p>
      <span className="t-headline block">{live.title}</span>
      <span className="t-callout read-more">Watch the service <ArrowRight size={14} className="chev" /></span>
    </button>
  );
}

function MessageCard({ message, onOpen }) {
  return (
    <button type="button" className="card home-card message-card" onClick={() => onOpen(message)}>
      <p className="t-overline">Daily message</p>
      <span className="t-headline">{message.title}</span>
      {message.reference_verse && <span className="t-caption block">{message.reference_verse}</span>}
      <span className="t-callout read-more">Read the message <ArrowRight size={14} className="chev" /></span>
    </button>
  );
}

function PreviewCard({ overline, rows, allLabel, onAll, renderRow }) {
  return (
    <section className="card home-card" aria-label={overline}>
      <div className="card-head">
        <p className="t-overline">{overline}</p>
        <button type="button" className="t-caption see-all" onClick={onAll}>{allLabel}</button>
      </div>
      <ul className="preview-list">
        {rows.map((row) => (
          <li key={row.key} className="preview-row">{renderRow(row)}</li>
        ))}
      </ul>
    </section>
  );
}

function Skeletons() {
  return (
    <>
      <div className="skeleton sk-title" aria-hidden="true" />
      <div className="card home-card skeleton sk-card" aria-hidden="true" />
      <div className="card home-card skeleton sk-card" aria-hidden="true" />
      <div className="card home-card skeleton sk-card" aria-hidden="true" />
    </>
  );
}

export default function HomeTab({ profile, home, onOpenProfile, onOpenMessage, onOpenSermon, onOpenEvent, onSelectTab }) {
  const [now] = useState(() => new Date());
  const first = profile?.name?.trim().split(/\s+/)[0] ?? "";
  const part = partOfDay(now);
  const todayIsoLocal = todayIso(now);
  const loadEventsCb = useCallback((opts) => loadEvents(opts), []);
  const eventsCache = useContentData(loadEventsCb, profile?.branchSlug ?? "");
  const { status, data, source, fetchedAt, greeting, chooseGreeting, pullRefresh } = home;

  useEffect(() => {
    chooseGreeting(part);
  }, [part, chooseGreeting]);

  const greetingText = greeting
    ? fillName(greeting.text, first)
    : fillName(GREETINGS[part][0], first);

  if (!profile?.branchSlug) {
    return (
      <>
        <header className="screen-intro">
          <p className="t-overline">{dayLabel(todayIsoLocal)}</p>
          <h1 className="t-display">{greetingText}</h1>
        </header>
        <Notice kind="info" action={
          <button type="button" className="button button-primary notice-action" onClick={onOpenProfile}>
            Choose your branch
          </button>
        }>
          Choose your branch and the app will show your church's daily message, sermons and events.
        </Notice>
      </>
    );
  }

  const upcomingEvents = data?.events ?? [];
  const recentPast = upcomingEvents.length ? [] : pastEvents(eventsCache.data?.events ?? [], data?.date ?? todayIsoLocal).slice(0, 3);
  const previewEvents = upcomingEvents.length ? upcomingEvents : recentPast;
  const previewRecent = !upcomingEvents.length && recentPast.length > 0;
  const slots = homeSlots(data ? { ...data, events: previewEvents } : data);
  const loading = status === "loading" && !data;

  return (
    <>
      <header className="screen-intro">
        <p className="t-overline">{dayLabel(data?.date ?? todayIsoLocal)}</p>
        <h1 className="t-display">{greetingText}</h1>
      </header>
      <UpdatedRow fetchedAt={fetchedAt} source={source} onRefresh={pullRefresh} refreshing={status === "refreshing"} />

      {source === "offline" && !data && (
        <Notice kind="offline" action={
          <button type="button" className="button button-quiet notice-action" onClick={pullRefresh}>Try again</button>
        }>
          No internet right now, and nothing saved for {profile.branchSlug} yet. The app will fill in when you're back online.
        </Notice>
      )}
      {source === "cache" && (
        <p className="t-caption offline-note">You're offline — showing what was saved on this phone.</p>
      )}

      {loading && <Skeletons />}

      {!loading && slots.map((slot) => {
        if (slot === "greeting") return null;
        if (slot === "today-event") return <TodayCard key={slot} events={data.events} today={data.date} onOpen={onOpenEvent} />;
        if (slot === "live") return <LiveCard key={slot} live={data.live} onOpen={onOpenSermon} />;
        if (slot === "verse") return <VerseCard key={slot} verse={data.verse} />;
        if (slot === "message") return <MessageCard key={slot} message={data.daily_message} onOpen={onOpenMessage} />;
        if (slot === "sermons") {
          return (
            <PreviewCard key={slot} overline="Latest sermons" allLabel="See all" onAll={() => onSelectTab("sermons")}
              rows={data.sermons.slice(0, 3).map((s) => ({ key: s.video_id || s.title, s }))}
              renderRow={({ s }) => (
                <button type="button" className="preview-row preview-button" onClick={() => onOpenSermon(s)}>
                  <span className="grow">
                    <span className="t-body block">{s.title}</span>
                    <span className="t-caption block">{dayLabel(s.preached_at?.slice(0, 10))}{s.reference_verse ? ` · ${s.reference_verse}` : ""}</span>
                  </span>
                  <ArrowRight size={16} className="chev" />
                </button>
              )} />
          );
        }
        if (slot === "events") {
          return (
            <PreviewCard key={slot} overline={previewRecent ? "Recently at your branch" : "Coming up"} allLabel="See all" onAll={() => onSelectTab("events")}
              rows={previewEvents.slice(0, 3).map((e) => ({ key: String(e.id), e }))}
              renderRow={({ e }) => (
                <button type="button" className="preview-row preview-button" onClick={() => onOpenEvent(e)}>
                  <span className="grow">
                    <span className="t-body block">{e.title}</span>
                    <span className="t-caption block">{dayLabel(e.date)} · {e.start_time?.slice(0, 5)} · {e.location}</span>
                  </span>
                  <ArrowRight size={16} className="chev" />
                </button>
              )} />
          );
        }
        return null;
      })}
    </>
  );
}
