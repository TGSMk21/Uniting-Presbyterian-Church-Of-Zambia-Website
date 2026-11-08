"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CalendarDays, ChevronLeft, ChevronRight, Clock, FolderKanban, GalleryHorizontal, LayoutGrid, MapPin, Pause, Play, X,
} from "lucide-react";
import RichText from "@/components/UniversalComponents/rich-text";
import { SLIDE_SECONDS, prefersReducedMotion, shouldAdvance, step } from "@/Utilities/slideshow.mjs";

// Projects and events (once called activities) as cards that open into an overlay with their photos and
// details (owner's request, 2026-11-08). Each card has its own address (#project-12),
// so a link from the home page can open it straight away.

function Media({ item, children }) {
  return (
    <div className="pa-media">
      {item.cover ? (
        <img src={item.cover} alt="" loading="lazy" />
      ) : (
        <div className="pa-media-empty" aria-hidden="true">
          {item.kind === "Project" ? <FolderKanban size={32} strokeWidth={1.25} /> : <CalendarDays size={32} strokeWidth={1.25} />}
        </div>
      )}
      {item.photos.length > 1 && <span className="pa-media-count">{item.photos.length} photos</span>}
      {children}
    </div>
  );
}

function Progress({ value, label = true }) {
  return (
    <div className="pa-progress">
      {label && (
        <div className="pa-progress-label">
          <span>Progress</span>
          <strong>{value}%</strong>
        </div>
      )}
      <div className="pa-progress-track" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}
        aria-label="Progress">
        <div className="pa-progress-fill" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function Card({ item, onOpen, muted }) {
  return (
    <li>
      <button type="button" className="pa-card" data-muted={muted || undefined} onClick={() => onOpen(item)}
        aria-haspopup="dialog" id={`card-${item.key}`}>
        <Media item={item}>
          {item.kind === "Event" && (
            <span className="pa-date" aria-hidden="true">
              <strong>{item.day.number}</strong>
              <span>{item.day.month}</span>
            </span>
          )}
        </Media>
        <span className="pa-card-body">
          {item.kind === "Project" && <span className={`pa-status pa-status-${item.status.tone}`}>{item.status.text}</span>}
          <span className="pa-card-title">{item.title}</span>
          {item.kind === "Project" ? (
            <>
              <span className="pa-card-meta">{item.when}</span>
              <Progress value={item.progress} label={false} />
            </>
          ) : (
            <span className="pa-card-meta">{[item.day.weekday, item.time, item.location].filter(Boolean).join(" · ")}</span>
          )}
        </span>
      </button>
    </li>
  );
}

function Gallery({ item }) {
  const count = item.photos.length;
  const [index, setIndex] = useState(0);
  const [view, setView] = useState("slides");
  // It moves on by itself unless the visitor prefers less motion; Pause stops it.
  const [playing, setPlaying] = useState(() => !prefersReducedMotion());
  const [held, setHeld] = useState(false);
  const start = useRef(null);
  const go = useCallback((by) => setIndex((current) => step(current, by, count)), [count]);
  // Choosing a photo yourself stops the slideshow, so it doesn't move away from it.
  const choose = useCallback((by) => { setPlaying(false); go(by); }, [go]);

  useEffect(() => {
    if (view !== "slides" || !shouldAdvance({ count, playing, held })) return undefined;
    const timer = window.setTimeout(() => go(1), SLIDE_SECONDS * 1000);
    return () => window.clearTimeout(timer);
  }, [view, count, playing, held, index, go]);

  useEffect(() => {
    if (count < 2 || view !== "slides") return undefined;
    const onKey = (event) => {
      if (event.key === "ArrowLeft") choose(-1);
      if (event.key === "ArrowRight") choose(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [count, view, choose]);

  const photo = item.photos[index];
  const hold = {
    onPointerEnter: (event) => { if (event.pointerType === "mouse") setHeld(true); },
    onPointerLeave: () => setHeld(false),
    onFocus: () => setHeld(true),
    onBlur: () => setHeld(false),
  };

  return (
    <div className="pa-gallery" data-view={view}>
      {view === "grid" ? (
        <div className="pa-grid-view">
          <ul aria-label={`All ${count} photos`}>
            {item.photos.map((p, i) => (
              <li key={p.id}>
                <button type="button" onClick={() => { setIndex(i); setPlaying(false); setView("slides"); }}
                  aria-label={`Open photo ${i + 1} of ${count}`}>
                  <img src={p.url} alt="" loading="lazy" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div
          className="pa-gallery-stage"
          {...hold}
          onPointerDown={(event) => { start.current = event.clientX; }}
          onPointerUp={(event) => {
            if (start.current === null) return;
            const moved = event.clientX - start.current;
            start.current = null;
            if (Math.abs(moved) > 40) choose(moved < 0 ? 1 : -1);
          }}
        >
          {/* The same photo, blurred, fills the space a tall or wide photo leaves. */}
          <img key={`b${photo.id}`} className="pa-gallery-backdrop" src={photo.url} alt="" aria-hidden="true" />
          <img key={photo.id} className="pa-gallery-photo" src={photo.url} alt={`${item.title}, photo ${index + 1} of ${count}`} />
          {count > 1 && (
            <>
              <button type="button" className="pa-gallery-arrow" data-side="left" onClick={() => choose(-1)} aria-label="Previous photo">
                <ChevronLeft size={22} aria-hidden="true" />
              </button>
              <button type="button" className="pa-gallery-arrow" data-side="right" onClick={() => choose(1)} aria-label="Next photo">
                <ChevronRight size={22} aria-hidden="true" />
              </button>
              {playing && !held && <span key={index} className="pa-gallery-timer" aria-hidden="true" style={{ animationDuration: `${SLIDE_SECONDS}s` }} />}
            </>
          )}
        </div>
      )}
      {count > 1 && (
        <div className="pa-gallery-bar">
          {view === "slides" ? (
            <>
              <button type="button" className="pa-gallery-tool" onClick={() => setPlaying((value) => !value)}
                aria-label={playing ? "Pause slideshow" : "Play slideshow"}>
                {playing ? <Pause size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}
              </button>
              <span className="pa-gallery-count" aria-live={playing ? "off" : "polite"}>{index + 1} / {count}</span>
              <ul className="pa-thumbs" aria-label="Photos">
                {item.photos.map((p, i) => (
                  <li key={p.id}>
                    <button type="button" onClick={() => { setPlaying(false); setIndex(i); }} aria-label={`Show photo ${i + 1}`}
                      aria-current={i === index || undefined}>
                      <img src={p.url} alt="" loading="lazy" />
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <span className="pa-gallery-count">{count} photos</span>
          )}
          <button type="button" className="pa-gallery-tool pa-gallery-switch" onClick={() => setView(view === "slides" ? "grid" : "slides")}
            aria-pressed={view === "grid"}>
            {view === "slides" ? <LayoutGrid size={16} aria-hidden="true" /> : <GalleryHorizontal size={16} aria-hidden="true" />}
            <span>{view === "slides" ? "All photos" : "Slideshow"}</span>
          </button>
        </div>
      )}
    </div>
  );
}

function Overlay({ item, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog.showModal();
    const root = document.documentElement;
    const before = root.style.overflow;
    root.style.overflow = "hidden";
    return () => {
      root.style.overflow = before;
      if (dialog.open) dialog.close();
    };
  }, []);

  return (
    <dialog ref={ref} className="pa-dialog" aria-labelledby="pa-dialog-title" data-plain={item.photos.length === 0 || undefined}
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onClick={(event) => { if (event.target === ref.current) onClose(); }}>
      <div className="pa-dialog-panel">
        <button type="button" className="pa-dialog-close" onClick={onClose} aria-label="Close">
          <X size={20} aria-hidden="true" />
        </button>
        {item.photos.length > 0 && <Gallery item={item} />}
        <div className="pa-dialog-details">
          <p className="pa-dialog-kind">
            {item.kind}
            {item.kind === "Project" && <span className={`pa-status pa-status-${item.status.tone}`}>{item.status.text}</span>}
          </p>
          <h2 id="pa-dialog-title" className="pa-dialog-title">{item.title}</h2>
          <ul className="pa-dialog-meta">
            <li><CalendarDays size={16} aria-hidden="true" /> {item.when}</li>
            {item.time && <li><Clock size={16} aria-hidden="true" /> {item.time}</li>}
            {item.location && <li><MapPin size={16} aria-hidden="true" /> {item.location}</li>}
          </ul>
          {item.kind === "Project" && <Progress value={item.progress} />}
          <div className="pa-dialog-text">
            {item.paragraphs.map((paragraph, i) => <p key={i}>{paragraph}</p>)}
          </div>
        </div>
      </div>
    </dialog>
  );
}

export default function ItemBoard({ sections }) {
  const [open, setOpen] = useState(null);
  const all = sections.flatMap((section) => section.items);

  const show = useCallback((item) => {
    setOpen(item);
    window.history.replaceState(null, "", `#${item.key}`);
  }, []);
  const close = useCallback(() => {
    const key = open?.key;
    setOpen(null);
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
    // Back to the card that was opened, for keyboard and screen reader users, once the
    // overlay has gone (until then the page behind it can't take focus).
    if (key) window.setTimeout(() => document.getElementById(`card-${key}`)?.focus(), 0);
  }, [open]);

  // A link such as /chilanga/projects-and-events#project-12 opens that one, whether
  // it's followed from another page or on this one.
  useEffect(() => {
    let timer;
    const openFromAddress = () => {
      // Links made before "activities" were renamed "events" still open the right card.
      const key = window.location.hash.slice(1).replace(/^activity-/, "event-");
      const found = key && all.find((item) => item.key === key);
      if (!found) return;
      document.getElementById(`card-${key}`)?.scrollIntoView({ block: "center" });
      // After the page has drawn, so the overlay opens over it rather than during it.
      timer = window.setTimeout(() => setOpen(found), 0);
    };
    openFromAddress();
    window.addEventListener("hashchange", openFromAddress);
    return () => {
      window.removeEventListener("hashchange", openFromAddress);
      window.clearTimeout(timer);
    };
    // The cards don't change while the page is open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      {sections.map((section) => (
        <section key={section.id} className="pa-section" aria-labelledby={`pa-${section.id}`}>
          <div className="pa-section-head">
            <div className="section-label">{section.eyebrow}</div>
            <h2 id={`pa-${section.id}`} className="section-title" style={{ fontFamily: "var(--font-playfair)" }}>
              <RichText text={section.title} />
            </h2>
          </div>
          {section.items.length === 0 ? (
            <p className="pa-empty">{section.empty}</p>
          ) : (
            <ul className="pa-grid">
              {section.items.map((item) => <Card key={item.key} item={item} onOpen={show} muted={section.muted} />)}
            </ul>
          )}
        </section>
      ))}
      {open && <Overlay key={open.key} item={open} onClose={close} />}
    </>
  );
}
