import { ScrollReveal } from "@/components/UniversalComponents/scroll-reveal";
import RichText from "@/components/UniversalComponents/rich-text";
import { CalendarDays, FolderKanban } from "lucide-react";
import { getActivities, getAnnouncements, getBranch, getDailyMessages, getPageContent, getProjects } from "@/Services/api";
import { glimpseItems } from "@/Utilities/projectItems.mjs";
import { branchSlides } from "@/Utilities/heroSlides.mjs";
import HeroCarousel from "@/components/UniversalComponents/hero-carousel";
import { pageFields } from "@/Utilities/pageContent.mjs";
import ContactForm from "@/components/UniversalComponents/contact-form";
import { dateFormat } from "@/Utilities/DateFormatter";
import { formatTime } from "@/Utilities/timeFormat";

export const revalidate = 3600;

function announceDate(iso) {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })
    .format(new Date(`${iso}T12:00:00Z`));
}

export default async function BranchHome({ params }) {
  const { branch: slug } = await params;
  // The layout already 404s unknown branches; both requests are deduplicated by Next.
  const [branch, messages, content, announcementData, projectData, activityData] = await Promise.all([
    getBranch(slug),
    getDailyMessages(slug),
    getPageContent(slug),
    getAnnouncements(slug),
    getProjects(slug),
    getActivities(slug),
  ]);
  const glimpse = glimpseItems(projectData?.results, activityData?.results);
  const announcements = announcementData?.results || [];
  // The tagline, welcome text, year theme and first banner photo are stored on the branch itself.
  const f = pageFields(
    "branch",
    "home",
    {
      ...content?.pages?.home,
      tagline: branch?.tagline,
      welcome_text: branch?.welcome_text,
      year_theme_title: branch?.year_theme_title,
      year_theme_text: branch?.year_theme_text,
      hero_image: branch?.hero_image,
    },
    { branchName: branch?.name },
  );
  const msg = messages?.results?.[0] || null;
  const verse = msg?.verse_text
    ? { text: msg.verse_text, ref: msg.reference_verse }
    : { text: f.verse_text, ref: f.verse_ref };
  const formattedDate = msg?.date ? dateFormat(msg.date) : null;
  const services = branch?.service_times || [];
  const year = new Date().getFullYear();

  return (
    <>

      <HeroCarousel slides={branchSlides(f, { slug, hasServices: services.length > 0 })} label={branch?.name} />

      {f.year_theme_title && (
        <section className="year-theme">
          <div className="year-theme-inner">
            <div className="year-theme-label">{year} Church Theme</div>
            <h2 className="year-theme-title" style={{ fontFamily: "var(--font-playfair)" }}>
              {f.year_theme_title}
            </h2>
            {f.year_theme_text && (
              <>
                <div className="year-theme-divider" />
                <p className="year-theme-desc" style={{ fontFamily: "var(--font-cormorant)" }}>
                  {f.year_theme_text}
                </p>
              </>
            )}
          </div>
        </section>
      )}

      <ScrollReveal>
        <section className="daily-verse">
          <div className="daily-verse-inner">
            <div className="daily-verse-badge">{f.verse_label}</div>
            <p className="daily-verse-text" style={{ fontFamily: "var(--font-cormorant)" }}>
              {verse.text}
            </p>
            <p className="daily-verse-ref">{verse.ref && `— ${verse.ref}`}</p>
          </div>
        </section>
      </ScrollReveal>

      {/* Always shown, so visitors know where notices appear (owner's request, 2026-11-08). */}
      <section className="announce-section" id="announcements">
        <div className="section-inner announce-layout">
          <div className="announce-head">
            <div className="section-label">{f.announcements_label}</div>
            <h2 className="section-title" style={{ fontFamily: "var(--font-playfair)" }}>
              <RichText text={f.announcements_title} />
            </h2>
          </div>
          {announcements.length === 0 ? (
            <p className="announce-empty">{f.announcements_empty}</p>
          ) : (
          <ul className="announce-list">
            {announcements.map((item) => (
              <li key={item.id} className="announce-card" data-pinned={item.is_pinned || undefined}>
                <div className="announce-meta">
                  {item.is_pinned && <span className="announce-pin">Pinned</span>}
                  <time dateTime={item.starts_on}>{announceDate(item.starts_on)}</time>
                </div>
                <h3 className="announce-title">{item.title}</h3>
                {item.body.split(/\n\s*\n/).map((paragraph, i) => (
                  <p key={i} className="announce-body">{paragraph}</p>
                ))}
              </li>
            ))}
          </ul>
          )}
        </div>
      </section>

      {msg && (
        <section className="devotion">
          <div className="section-inner">
            <div className="section-header">
              <div>
                <div className="section-label">{f.devotion_label}</div>
                <h2 className="section-title" style={{ fontFamily: "var(--font-playfair)" }}>
                  <RichText text={f.devotion_title} />
                </h2>
              </div>
            </div>
            <ScrollReveal>
              <div className="devotion-grid">
                <div className="devotion-visual">
                  <div>
                    <div className="devotion-badge">{f.devotion_label}</div>
                    <h3 className="devotion-title" style={{ fontFamily: "var(--font-playfair)" }}>
                      {msg.title}
                    </h3>
                    <p className="devotion-ref">{msg.reference_verse && `— ${msg.reference_verse}`}</p>
                  </div>
                  {formattedDate && (
                    <div className="devotion-date-block">
                      <div className="devotion-date-day">{formattedDate.day}</div>
                      <div className="devotion-date-month">{formattedDate.monthLong}</div>
                    </div>
                  )}
                </div>
                <div className="devotion-body">
                  {msg.message.split(/\n\s*\n/).map((paragraph, i) => (
                    <p key={i}>{paragraph}</p>
                  ))}
                  {msg.minister_name && (
                    <div className="devotion-attribution">
                      - <strong>{msg.minister_name}</strong>
                    </div>
                  )}
                </div>
              </div>
            </ScrollReveal>
          </div>
        </section>
      )}

      {services.length > 0 && (
        <section className="schedule-section" id="schedule">
          <div className="section-inner">
            <div className="section-header">
              <div>
                <div className="section-label">{f.schedule_label}</div>
                <h2 className="section-title" style={{ fontFamily: "var(--font-playfair)" }}>
                  <RichText text={f.schedule_title} />
                </h2>
              </div>
            </div>
            <div className="schedule-grid">
              {services.map((item, i) => (
                <ScrollReveal key={item.id} delay={i + 1}>
                  <div className="schedule-card">
                    <div className="schedule-day">{item.day}</div>
                    <h3 className="schedule-name">{item.title}</h3>
                    <div className="schedule-meta">
                      <div className="schedule-meta-row">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10" />
                          <polyline points="12 6 12 12 16 14" />
                        </svg>
                        <span>{formatTime(item.start_time)} – {formatTime(item.end_time)}</span>
                      </div>
                      {item.location && (
                        <div className="schedule-meta-row">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                            <circle cx="12" cy="10" r="3" />
                          </svg>
                          <span>{item.location}</span>
                        </div>
                      )}
                      {item.details && (
                        <div className="schedule-meta-row">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                            <polyline points="22 4 12 14.01 9 11.01" />
                          </svg>
                          <span>{item.details}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {glimpse.length > 0 && (
        <section className="glimpse-section" aria-labelledby="glimpse-title">
          <div className="section-inner">
            <div className="glimpse-head">
              <div>
                <div className="section-label">{f.glimpse_label}</div>
                <h2 id="glimpse-title" className="section-title" style={{ fontFamily: "var(--font-playfair)" }}>
                  <RichText text={f.glimpse_title} />
                </h2>
              </div>
              <a href={`/${slug}/projects-and-events`} className="btn-ghost glimpse-all">{f.glimpse_button}</a>
            </div>
            <ul className="pa-grid">
              {glimpse.map((item) => (
                <li key={item.key}>
                  <a href={`/${slug}/projects-and-events#${item.key}`} className="pa-card">
                    <span className="pa-media">
                      {item.cover ? (
                        <img src={item.cover} alt="" loading="lazy" />
                      ) : (
                        <span className="pa-media-empty" aria-hidden="true">
                          {item.kind === "Project" ? <FolderKanban size={32} strokeWidth={1.25} /> : <CalendarDays size={32} strokeWidth={1.25} />}
                        </span>
                      )}
                      {item.kind === "Event" && (
                        <span className="pa-date" aria-hidden="true"><strong>{item.day.number}</strong><span>{item.day.month}</span></span>
                      )}
                    </span>
                    <span className="pa-card-body">
                      <span className="pa-card-kind">{item.kind === "Project" ? item.status.text : "Coming up"}</span>
                      <span className="pa-card-title">{item.title}</span>
                      <span className="pa-card-meta">
                        {item.kind === "Project" ? `${item.when} · ${item.progress}% done` : [item.day.weekday, item.time, item.location].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <section className="contact-section">
        <div className="section-inner">
          <div className="section-header" style={{ justifyContent: "center", textAlign: "center" }}>
            <div>
              <div className="section-label" style={{ justifyContent: "center" }}>{f.contact_label}</div>
              <h2 className="section-title" style={{ fontFamily: "var(--font-playfair)", maxWidth: "none" }}>
                <RichText text={f.contact_title} />
              </h2>
            </div>
          </div>
          <ScrollReveal>
            <div className="contact-card">
              <p className="contact-sub">{f.contact_text}</p>
              <ContactForm branch={slug} />
            </div>
          </ScrollReveal>
        </div>
      </section>

    </>
  );
}
