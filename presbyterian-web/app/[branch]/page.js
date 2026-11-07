import { ScrollReveal } from "@/components/UniversalComponents/scroll-reveal";
import RichText from "@/components/UniversalComponents/rich-text";
import { getBranch, getDailyMessages, getPageContent } from "@/Services/api";
import { pageFields } from "@/Utilities/pageContent.mjs";
import ContactForm from "@/components/UniversalComponents/contact-form";
import { dateFormat } from "@/Utilities/DateFormatter";
import { formatTime } from "@/Utilities/timeFormat";

export const revalidate = 3600;

export default async function BranchHome({ params }) {
  const { branch: slug } = await params;
  // The layout already 404s unknown branches; both requests are deduplicated by Next.
  const [branch, messages, content] = await Promise.all([
    getBranch(slug),
    getDailyMessages(slug),
    getPageContent(slug),
  ]);
  // The tagline, welcome text and year theme are stored on the branch itself.
  const f = pageFields(
    "branch",
    "home",
    {
      ...content?.pages?.home,
      tagline: branch?.tagline,
      welcome_text: branch?.welcome_text,
      year_theme_title: branch?.year_theme_title,
      year_theme_text: branch?.year_theme_text,
    },
    { branchName: branch?.name },
  );
  const msg = messages?.results?.[0] || null;
  const verse = msg?.verse_text
    ? { text: msg.verse_text, ref: msg.reference_verse }
    : { text: f.verse_text, ref: f.verse_ref };
  const formattedDate = msg?.date ? dateFormat(msg.date) : null;
  const services = branch?.service_times || [];
  const heroImages = [branch?.hero_image, branch?.hero_image_secondary].filter(Boolean);
  const year = new Date().getFullYear();

  return (
    <>

      <section className="hero">
        <div className="hero-blob-1" />
        <div className="hero-blob-2" />
        <div className="hero-grid">
          <div>
            <div className="hero-eyebrow">{f.hero_label}</div>
            <h1 style={{ fontFamily: "var(--font-playfair)" }}>
              <RichText text={f.tagline} />
            </h1>
            <p className="hero-desc">{f.welcome_text}</p>
            <div className="hero-actions">
              {services.length > 0 && <a href="#schedule" className="btn-primary">{f.schedule_button}</a>}
              <a href={`/${slug}/about`} className="btn-ghost">{f.story_button}</a>
            </div>
          </div>
          {heroImages.length > 0 && (
            <div className="hero-visual">
              <div className="hero-img-main">
                <img src={heroImages[0]} alt={`${branch.name} worship`} />
              </div>
              {heroImages[1] && (
                <div className="hero-img-accent">
                  <img src={heroImages[1]} alt={`${branch.name} community`} />
                </div>
              )}
              {f.year_theme_title && (
                <div className="hero-floating">
                  <div className="hero-floating-label">{year} Theme</div>
                  <div className="hero-floating-text">{f.year_theme_title}</div>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

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
