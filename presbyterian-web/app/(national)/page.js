import Link from "next/link";
import { ScrollReveal } from "@/components/UniversalComponents/scroll-reveal";
import { getUpcomingActivities } from "@/Services/api";

export const revalidate = 3600;

const EVENTS_SHOWN = 6;

const fellowships = [
  { id: "1", title: "Youth Fellowship", img: "/youthMin.png", ref: "1 Timothy 4:12", desc: "Empowering young hearts to live boldly for Christ through worship, discipleship, and fellowship that transforms lives." },
  { id: "2", title: "Children's Fellowship", img: "/cm.png", ref: "Matthew 19:14", desc: "Planting seeds of faith in young hearts through engaging Bible lessons, worship, and activities that make God's love real." },
  { id: "3", title: "Men's Fellowship", img: "/mm.png", ref: "1 Corinthians 16:13", desc: "Building godly men of integrity through brotherhood, accountability, and purpose-driven discipleship in Christ." },
  { id: "4", title: "Women's Fellowship", img: "/wm.png", ref: "Proverbs 31:25", desc: "Nurturing women of faith to discover their God-given purpose through prayer, study, and authentic community." },
];

// "2026-12-06" → { day: "06", month: "Dec", year: "2026" }, without timezone shifts.
function eventDate(isoDate) {
  const [year, month, day] = isoDate.split("-");
  const monthName = new Date(Date.UTC(year, month - 1, 1))
    .toLocaleString("en-US", { month: "short", timeZone: "UTC" });
  return { day, month: monthName, year };
}

export default async function NationalLanding() {
  const activities = await getUpcomingActivities();
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
            <span className="nat-eyebrow">Uniting Presbyterian Church In Zambia</span>
            <h1 className="nat-h1">
              One family.
              <br />
              <em>Many houses.</em>
            </h1>
            <p className="nat-lede">
              Wherever you are in Zambia, there is a branch of our family near
              you — a place to worship, to grow, and to belong.
            </p>
            <div className="nat-hero-actions">
              <Link href="/find-a-branch" className="btn-primary">
                Find a branch near you
              </Link>
              <a href="#welcome" className="nat-link-quiet">
                Our story <span aria-hidden="true">→</span>
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
                <div className="nat-arch-tag-label">Gathered</div>
                <div className="nat-arch-tag-text">Across Zambia, every week</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== MANIFESTO / WELCOME ===== */}
      <section className="nat-manifesto" id="welcome">
        <div className="nat-manifesto-inner">
          <span className="nat-eyebrow">Welcome home</span>
          <ScrollReveal>
            <p className="nat-manifesto-text">
              Faith is not a building you visit on a Sunday — it is a family you
              belong to every day. Across Zambia, our branches gather in cities
              and villages, in sanctuaries and living rooms, to worship, to
              serve, and to walk together. <em>And there is always room for one more.</em>
            </p>
          </ScrollReveal>
        </div>
      </section>

      {/* ===== FELLOWSHIPS ===== */}
      <section className="nat-fellowships" id="fellowships">
        <div className="section-inner">
          <div className="section-header">
            <div>
              <div className="section-label">Our Fellowships</div>
              <h2 className="section-title" style={{ fontFamily: "var(--font-playfair)" }}>
                Every generation, <em>every season</em>
              </h2>
            </div>
          </div>
          <div className="ministries-grid">
            {fellowships.map((item, i) => (
              <ScrollReveal key={item.id} delay={i + 1}>
                <div className="ministry-card">
                  <div className="ministry-img">
                    <img loading="lazy" src={item.img} alt={item.title} />
                  </div>
                  <div className="ministry-body">
                    <h3 className="ministry-title">{item.title}</h3>
                    <p className="ministry-verse">{item.ref}</p>
                    <p className="ministry-desc">{item.desc}</p>
                  </div>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ===== FIND A BRANCH ===== */}
      <section className="nat-branches">
        <div className="nat-branches-inner">
          <div className="nat-branches-head">
            <span className="nat-eyebrow">Our branches</span>
            <h2 className="nat-h2">
              Find a branch <em>near you</em>
            </h2>
            <p className="nat-branches-sub">
              Each branch is its own community — the same faith, rooted in your
              neighbourhood.
            </p>
          </div>

          <ScrollReveal>
            <Link href="/find-a-branch" className="nat-branch-card">
              <span className="nat-branch-card-main">
                <span className="nat-branch-card-title">Find a branch</span>
                <span className="nat-branch-card-text">
                  Search by name or area, see every branch on the map, or find
                  the one closest to you.
                </span>
              </span>
              <span className="nat-branch-card-arrow" aria-hidden="true">→</span>
            </Link>
          </ScrollReveal>
        </div>
      </section>

      {/* ===== NATIONWIDE EVENTS (upcoming activities of every branch) ===== */}
      {events.length > 0 && (
      <section className="nat-events" id="events">
        <div className="nat-events-inner">
          <div className="nat-events-head">
            <span className="nat-eyebrow">Nationwide events</span>
            <h2 className="nat-h2">
              Gather <em>together</em>
            </h2>
            <p className="nat-events-sub">
              Across the year, we come together as one family for conferences,
              assemblies, and celebrations.
            </p>
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
          <span className="nat-eyebrow light">An open invitation</span>
          <h2 className="nat-closing-title">
            Come as you are.
            <br />
            <em>Leave as family.</em>
          </h2>
          <p className="nat-closing-sub">
            No matter your story, you are welcome at any of our branches this
            week.
          </p>
          <Link href="/find-a-branch" className="btn-primary">
            Find your branch
          </Link>
        </div>
      </section>
    </main>
  );
}
