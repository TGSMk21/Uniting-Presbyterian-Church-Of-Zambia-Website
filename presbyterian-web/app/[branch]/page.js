'use client';

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { ScrollReveal } from "@/components/UniversalComponents/scroll-reveal";
import { playfair, cormorant } from "@/app/fonts";
import { getDailyMessages } from "@/Services/api";
import ContactForm from "@/components/UniversalComponents/contact-form";
import { dateFormat } from "@/Utilities/DateFormatter";

const scheduleData = [
  { id: "1", day: "Every Sunday", title: "Sunday Worship Service", time: "9:00 AM – 11:00 AM", location: "Main Church Sanctuary", activities: "Worship · Word · Communion" },
  { id: "2", day: "Every Wednesday", title: "Midweek Bible Study", time: "4:30 PM – 6:30 PM", location: "Fellowship Hall", activities: "Scripture · Discussion · Prayer" },
];

export default function Home() {
  const { branch } = useParams();
  const [verse, setVerse] = useState(null);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    getDailyMessages(branch).then((data) => {
      if (data?.results?.length) {
        const m = data.results[0];
        setMsg(m);
        setVerse({ scripture: m.message, verse: m.reference_verse });
      }
    });
  }, [branch]);

  let formattedDate = null;
  if (msg?.date) {
    formattedDate = dateFormat(msg.date);
  }

  return (
    <>

      <section className="hero">
        <div className="hero-blob-1" />
        <div className="hero-blob-2" />
        <div className="hero-grid">
          <div>
            <div className="hero-eyebrow">Welcome to our family</div>
            <h1 style={{ fontFamily: "var(--font-playfair)" }}>
              A place of <em>grace,</em> belonging & purpose.
            </h1>
            <p className="hero-desc">
              Whether you are exploring faith or looking for a church home, you are welcome here.
              At Chilanga Presbyterian, we walk together in faith, hope, and love.
            </p>
            <div className="hero-actions">
              <a href="#" className="btn-primary">Join Us This Sunday</a>
              <a href={`/${branch}/about`} className="btn-ghost">Our Story</a>
            </div>
          </div>
          <div className="hero-visual">
            <div className="hero-img-main">
              <img
                src="https://image.qwenlm.ai/public_source/e3258763-8dd2-46cd-885c-0b3ea5625da5/1f6753adb-59b2-4aae-a038-94af781708bb.png"
                alt="Church worship"
              />
            </div>
            <div className="hero-img-accent">
              <img
                src="https://image.qwenlm.ai/public_source/e3258763-8dd2-46cd-885c-0b3ea5625da5/161927027-00d0-4dd2-88db-8d9b73d624c0.png"
                alt="Church community"
              />
            </div>
            <div className="hero-floating">
              <div className="hero-floating-label">2026 Theme</div>
              <div className="hero-floating-text">Rooted in Faith, Growing in Love</div>
            </div>
          </div>
        </div>
      </section>

      <section className="year-theme">
        <div className="year-theme-inner">
          <div className="year-theme-label">2026 Church Theme</div>
          <h2 className="year-theme-title" style={{ fontFamily: "var(--font-playfair)" }}>
            Rooted in <em>Faith,</em>
          </h2>
          <h2 className="year-theme-title" style={{ fontFamily: "var(--font-playfair)" }}>
            Growing in <em>Love</em>
          </h2>
          <div className="year-theme-divider" />
          <p className="year-theme-desc" style={{ fontFamily: "var(--font-cormorant)" }}>
            This year, we deepen our spiritual roots through prayer and scripture while extending
            God&apos;s love to our community through service and compassion.
          </p>
        </div>
      </section>

      <ScrollReveal>
        <section className="daily-verse">
          <div className="daily-verse-inner">
            <div className="daily-verse-badge">Today&apos;s Scripture</div>
            <p className="daily-verse-text" style={{ fontFamily: "var(--font-cormorant)" }}>
              {verse ? verse.scripture : "The Lord is my shepherd; I shall not want."}
            </p>
            <p className="daily-verse-ref">
              {verse ? verse.verse : "— Psalm 23:1"}
            </p>
          </div>
        </section>
      </ScrollReveal>

      <section className="devotion">
        <div className="section-inner">
          <div className="section-header">
            <div>
              <div className="section-label">Daily Devotion</div>
              <h2 className="section-title" style={{ fontFamily: "var(--font-playfair)" }}>
                Words to carry <em>through your day</em>
              </h2>
            </div>
          </div>
          <ScrollReveal>
            <div className="devotion-grid">
              <div className="devotion-visual">
                <div>
                  <div className="devotion-badge">Daily Devotion</div>
                  <h3 className="devotion-title" style={{ fontFamily: "var(--font-playfair)" }}>
                    {msg ? msg.title : "Walking in His Light"}
                  </h3>
                  <p className="devotion-ref">
                    {msg ? msg.referenceVerse : "— Psalm 119:105"}
                  </p>
                </div>
                {formattedDate && (
                  <div className="devotion-date-block">
                    <div className="devotion-date-day">{formattedDate.day}</div>
                    <div className="devotion-date-month">{formattedDate.monthLong}</div>
                  </div>
                )}
              </div>
              <div className="devotion-body">
                <p>{msg ? msg.message : "Your word is a lamp to my feet and a light to my path."}</p>
                <p>
                  In every season of life, God&apos;s Word remains our sure foundation. It guides us
                  when the way is unclear and strengthens us when we grow weary. Let us hold fast to
                  the truth that has been passed down through generations of faith.
                </p>
                <p>
                  Today, take a moment to reflect on the goodness of the Lord. He is faithful
                  yesterday, today, and forever. May your heart be encouraged and your spirit
                  renewed as you walk in His boundless grace.
                </p>
                <div className="devotion-attribution">
                  - <strong>Reverend T. Mkandawire</strong>, Lead Pastor
                </div>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      <section className="schedule-section">
        <div className="section-inner">
          <div className="section-header">
            <div>
              <div className="section-label">Weekly Schedule</div>
              <h2 className="section-title" style={{ fontFamily: "var(--font-playfair)" }}>
                Gather with <em>us</em>
              </h2>
            </div>
          </div>
          <div className="schedule-grid">
            {scheduleData.map((item, i) => (
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
                      <span>{item.time}</span>
                    </div>
                    <div className="schedule-meta-row">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                        <circle cx="12" cy="10" r="3" />
                      </svg>
                      <span>{item.location}</span>
                    </div>
                    <div className="schedule-meta-row">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                        <polyline points="22 4 12 14.01 9 11.01" />
                      </svg>
                      <span>{item.activities}</span>
                    </div>
                  </div>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      <section className="contact-section">
        <div className="section-inner">
          <div className="section-header" style={{ justifyContent: "center", textAlign: "center" }}>
            <div>
              <div className="section-label" style={{ justifyContent: "center" }}>Get In Touch</div>
              <h2 className="section-title" style={{ fontFamily: "var(--font-playfair)", maxWidth: "none" }}>
                We&apos;d love to <em>hear</em> from you
              </h2>
            </div>
          </div>
          <ScrollReveal>
            <div className="contact-card">
              <p className="contact-sub">
                Have a question, prayer request, or just want to say hello? Reach out to us.
              </p>
              <ContactForm />
            </div>
          </ScrollReveal>
        </div>
      </section>

    </>
  );
}
