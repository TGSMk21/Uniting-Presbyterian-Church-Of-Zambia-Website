"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import RichText from "./rich-text";
import { SLIDE_SECONDS, prefersReducedMotion, shouldAdvance, step } from "@/Utilities/slideshow.mjs";

// The banner slides at the top of the national and branch home pages (owner's
// request, 2026-11-08); staff edit them under Pages in the dashboard. Every slide
// is in the page for search engines; only the current one can be seen or reached.
function watchMotion(onChange) {
  const query = window.matchMedia?.("(prefers-reduced-motion: reduce)");
  query?.addEventListener("change", onChange);
  return () => query?.removeEventListener("change", onChange);
}

function Action({ action }) {
  const className = action.primary ? "btn-primary" : "hero-slide-quiet";
  const inner = <>{action.label}{!action.primary && <span aria-hidden="true"> →</span>}</>;
  if (action.href.startsWith("/")) return <Link href={action.href} className={className}>{inner}</Link>;
  return <a href={action.href} className={className}>{inner}</a>;
}

export default function HeroCarousel({ slides, label = "Welcome" }) {
  const count = slides.length;
  const [index, setIndex] = useState(0);
  // Visitors who prefer less motion start paused; Play and Pause override that.
  const reduced = useSyncExternalStore(watchMotion, prefersReducedMotion, () => false);
  const [choice, setChoice] = useState(null);
  const playing = choice ?? !reduced;
  const [held, setHeld] = useState(false);
  const start = useRef(null);
  const go = useCallback((by) => setIndex((current) => step(current, by, count)), [count]);
  const choose = useCallback((to) => { setChoice(false); setIndex(to); }, []);

  useEffect(() => {
    if (!shouldAdvance({ count, playing, held })) return undefined;
    const timer = window.setTimeout(() => go(1), SLIDE_SECONDS * 1000 + 1000);
    return () => window.clearTimeout(timer);
  }, [count, playing, held, index, go]);

  const multiple = count > 1;
  return (
    <section
      className="hero-carousel"
      aria-roledescription="carousel"
      aria-label={label}
      onPointerEnter={(event) => { if (event.pointerType === "mouse") setHeld(true); }}
      onPointerLeave={() => setHeld(false)}
      onFocus={() => setHeld(true)}
      onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setHeld(false); }}
      onPointerDown={(event) => { start.current = event.clientX; }}
      onPointerUp={(event) => {
        if (start.current === null || !multiple) return;
        const moved = event.clientX - start.current;
        start.current = null;
        if (Math.abs(moved) > 50) choose(step(index, moved < 0 ? 1 : -1, count));
      }}
    >
      {slides.map((slide, i) => {
        const Heading = i === 0 ? "h1" : "h2";
        const current = i === index;
        return (
          <div
            key={slide.key}
            className="hero-slide"
            data-current={current || undefined}
            data-photo={slide.image ? true : undefined}
            role={multiple ? "group" : undefined}
            aria-roledescription={multiple ? "slide" : undefined}
            aria-label={multiple ? `${i + 1} of ${count}` : undefined}
            aria-hidden={current ? undefined : true}
            inert={current ? undefined : true}
          >
            {slide.image && <img className="hero-slide-photo" src={slide.image} alt="" fetchPriority={i === 0 ? "high" : "low"} loading={i === 0 ? "eager" : "lazy"} />}
            <div className="hero-slide-inner">
              <div className="hero-slide-copy">
                {slide.title && (
                  <Heading className="hero-slide-title">
                    <RichText text={slide.title} />
                  </Heading>
                )}
                {slide.text && <p className="hero-slide-text">{slide.text}</p>}
                {slide.actions.length > 0 && (
                  <div className="hero-slide-actions">
                    {slide.actions.map((action) => <Action key={action.href} action={action} />)}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}

      {multiple && (
        <div className="hero-carousel-controls">
          <button type="button" className="hero-carousel-button" onClick={() => choose(step(index, -1, count))} aria-label="Previous slide">
            <ChevronLeft size={18} aria-hidden="true" />
          </button>
          <ul className="hero-carousel-dots">
            {slides.map((slide, i) => (
              <li key={slide.key}>
                <button type="button" onClick={() => choose(i)} aria-label={`Show slide ${i + 1}`} aria-current={i === index || undefined}>
                  {i === index && playing && !held && (
                    <span key={index} className="hero-carousel-progress" style={{ animationDuration: `${SLIDE_SECONDS + 1}s` }} />
                  )}
                </button>
              </li>
            ))}
          </ul>
          <button type="button" className="hero-carousel-button" onClick={() => choose(step(index, 1, count))} aria-label="Next slide">
            <ChevronRight size={18} aria-hidden="true" />
          </button>
          <button type="button" className="hero-carousel-button" onClick={() => setChoice(!playing)}
            aria-label={playing ? "Pause slides" : "Play slides"}>
            {playing ? <Pause size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}
          </button>
        </div>
      )}
    </section>
  );
}
