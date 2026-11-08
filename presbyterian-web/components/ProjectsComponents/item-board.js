"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Clock, FolderKanban, MapPin, X } from "lucide-react";
import RichText from "@/components/UniversalComponents/rich-text";

// Projects and activities as cards that open into an overlay with their photos and
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
          {item.kind === "Activity" && (
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
  const [index, setIndex] = useState(0);
  const start = useRef(null);
  const count = item.photos.length;
  const go = useCallback((step) => setIndex((current) => (current + step + count) % count), [count]);

  useEffect(() => {
    if (count < 2) return undefined;
    const onKey = (event) => {
      if (event.key === "ArrowLeft") go(-1);
      if (event.key === "ArrowRight") go(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [count, go]);

  if (count === 0) {
    return (
      <div className="pa-gallery pa-gallery-empty" aria-hidden="true">
        {item.kind === "Project" ? <FolderKanban size={48} strokeWidth={1} /> : <CalendarDays size={48} strokeWidth={1} />}
      </div>
    );
  }
  return (
    <div className="pa-gallery">
      <div
        className="pa-gallery-stage"
        onPointerDown={(event) => { start.current = event.clientX; }}
        onPointerUp={(event) => {
          if (start.current === null) return;
          const moved = event.clientX - start.current;
          start.current = null;
          if (Math.abs(moved) > 40) go(moved < 0 ? 1 : -1);
        }}
      >
        <img key={item.photos[index].id} src={item.photos[index].url} alt={`${item.title}, photo ${index + 1} of ${count}`} />
        {count > 1 && (
          <>
            <button type="button" className="pa-gallery-arrow" data-side="left" onClick={() => go(-1)} aria-label="Previous photo">
              <ChevronLeft size={22} aria-hidden="true" />
            </button>
            <button type="button" className="pa-gallery-arrow" data-side="right" onClick={() => go(1)} aria-label="Next photo">
              <ChevronRight size={22} aria-hidden="true" />
            </button>
            <span className="pa-gallery-count" aria-live="polite">{index + 1} / {count}</span>
          </>
        )}
      </div>
      {count > 1 && (
        <ul className="pa-thumbs" aria-label="Photos">
          {item.photos.map((photo, i) => (
            <li key={photo.id}>
              <button type="button" onClick={() => setIndex(i)} aria-label={`Show photo ${i + 1}`} aria-current={i === index || undefined}>
                <img src={photo.url} alt="" loading="lazy" />
              </button>
            </li>
          ))}
        </ul>
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
    <dialog ref={ref} className="pa-dialog" aria-labelledby="pa-dialog-title"
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onClick={(event) => { if (event.target === ref.current) onClose(); }}>
      <div className="pa-dialog-panel">
        <button type="button" className="pa-dialog-close" onClick={onClose} aria-label="Close">
          <X size={20} aria-hidden="true" />
        </button>
        <Gallery item={item} />
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

  // A link such as /chilanga/projects-and-activities#project-12 opens that one, whether
  // it's followed from another page or on this one.
  useEffect(() => {
    let timer;
    const openFromAddress = () => {
      const key = window.location.hash.slice(1);
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
