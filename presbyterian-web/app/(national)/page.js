import Link from "next/link";
import { connection } from "next/server";
import { ScrollReveal } from "@/components/UniversalComponents/scroll-reveal";
import RichText from "@/components/UniversalComponents/rich-text";
import { getPageContent, getUpcomingActivities } from "@/Services/api";
import { pageFields } from "@/Utilities/pageContent.mjs";

const EVENTS_SHOWN = 6;

const fellowships = ["youth", "children", "men", "women"];

// "2026-12-06" → { day: "06", month: "Dec", year: "2026" }, without timezone shifts.
function eventDate(isoDate) {
  const [year, month, day] = isoDate.split("-");
  const monthName = new Date(Date.UTC(year, month - 1, 1))
    .toLocaleString("en-US", { month: "short", timeZone: "UTC" });
  return { day, month: monthName, year };
}

export default async function NationalLanding() {
  // Render on request, not at build time: a build that misses the API would
  // publish the page without its events. Good answers are still cached.
  await connection();
  const [activities, content] = await Promise.all([getUpcomingActivities(), getPageContent("national")]);
  const f = pageFields("national", "home", content?.pages?.home);
  const events = (activities?.results || []).slice(0, EVENTS_SHOWN).map((a) => ({
    id: a.id,
    title: a.title,
    location: [a.location, a.branch_name].filter(Boolean).join(" · "),
    ...eventDate(a.date),
  }));

  return (
    <main>
      {/* ===== HERO ===== */}
      <section className="nat-hero">
        <div className="nat-hero-inner">
          <div className="nat-hero-copy">
            <span className="nat-eyebrow">{f.hero_label}</span>
            <h1 className="nat-h1">
              <RichText text={f.hero_title} />
            </h1>
            <p className="nat-lede">{f.hero_text}</p>
            <div className="nat-hero-actions">
              <Link href="/find-a-branch" className="btn-primary">
                {f.hero_button}
              </Link>
              <a href="#welcome" className="nat-link-quiet">
                {f.story_link} <span aria-hidden="true">→</span>
              </a>
            </div>
          </div>

          <div className="nat-hero-visual" aria-hidden="true">
            <div className="nat-arch-wrap">
              <div className="nat-arch-back" />
              <div className="nat-arch">
                <svg
                  className="nat-arch-cross"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                >
                  <line x1="12" y1="4" x2="12" y2="21" />
                  <line x1="6" y1="9" x2="18" y2="9" />
                </svg>
              </div>
              <div className="nat-arch-tag">
                <div className="nat-arch-tag-label">{f.badge_label}</div>
                <div className="nat-arch-tag-text">{f.badge_text}</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== MANIFESTO / WELCOME ===== */}
      <section className="nat-manifesto" id="welcome">
        <div className="nat-manifesto-inner">
          <span className="nat-eyebrow">{f.welcome_label}</span>
          <ScrollReveal>
            <p className="nat-manifesto-text">
              <RichText text={f.welcome_text} />
            </p>
          </ScrollReveal>
        </div>
      </section>

      {/* ===== FELLOWSHIPS ===== */}
      <section className="nat-fellowships" id="fellowships">
        <div className="section-inner">
          <div className="section-header">
            <div>
              <div className="section-label">{f.fellowships_label}</div>
              <h2 className="section-title" style={{ fontFamily: "var(--font-playfair)" }}>
                <RichText text={f.fellowships_title} />
              </h2>
            </div>
          </div>
          <div className="ministries-grid">
            {fellowships.map((id, i) => (
              <ScrollReveal key={id} delay={i + 1}>
                <div className="ministry-card">
                  <div className="ministry-img">
                    <img loading="lazy" src={f[`${id}_image`]} alt={f[`${id}_title`]} />
                  </div>
                  <div className="ministry-body">
                    <h3 className="ministry-title">{f[`${id}_title`]}</h3>
                    <p className="ministry-verse">{f[`${id}_verse`]}</p>
                    <p className="ministry-desc">{f[`${id}_text`]}</p>
                  </div>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ===== NATIONWIDE EVENTS (upcoming activities of every branch) ===== */}
      {events.length > 0 && (
      <section className="nat-events" id="events">
        <div className="nat-events-inner">
          <div className="nat-events-head">
            <span className="nat-eyebrow">{f.events_label}</span>
            <h2 className="nat-h2">
              <RichText text={f.events_title} />
            </h2>
            <p className="nat-events-sub">{f.events_text}</p>
          </div>

          <div className="nat-event-list">
            {events.map((e, i) => (
              <ScrollReveal key={e.id} delay={(i % 3) + 1}>
                <div className="nat-event-row">
                  <div className="nat-event-date">
                    <span className="nat-event-day">{e.day}</span>
                    <span className="nat-event-month">{e.month}</span>
                    <span className="nat-event-year">{e.year}</span>
                  </div>
                  <div className="nat-event-main">
                    <h3 className="nat-event-title">{e.title}</h3>
                    <span className="nat-event-loc">{e.location}</span>
                  </div>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>
      )}

      {/* ===== CLOSING ===== */}
      <section className="nat-closing">
        <div className="nat-closing-inner">
          <span className="nat-eyebrow light">{f.closing_label}</span>
          <h2 className="nat-closing-title">
            <RichText text={f.closing_title} />
          </h2>
          <p className="nat-closing-sub">{f.closing_text}</p>
          <Link href="/find-a-branch" className="btn-primary">
            {f.closing_button}
          </Link>
        </div>
      </section>
    </main>
  );
}
