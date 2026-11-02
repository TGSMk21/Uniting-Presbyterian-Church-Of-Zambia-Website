import { ScrollReveal } from "@/components/UniversalComponents/scroll-reveal";
import { getBranch, getMinisters } from "@/Services/api";
import { formatTime } from "@/Utilities/timeFormat";

export const revalidate = 3600;

export default async function About({ params }) {
  const { branch: branchSlug } = await params;
  const [branch, ministersData] = await Promise.all([
    getBranch(branchSlug),
    getMinisters(branchSlug),
  ]);
  const ministers = ministersData?.results || [];
  const reverend = ministers[0];
  const bioParagraphs = (reverend?.bio || "").split(/\n\s*\n/).filter(Boolean);
  const services = branch?.service_times || [];
  const mapUrl = branch?.address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(branch.address)}`
    : null;
  return (
    <div className="container mx-auto max-w-full overflow-hidden min-w-full min-h-screen w-full">
      {/* Page Banner */}
      <section className="page-banner">
        <div className="page-banner-inner">
          <ScrollReveal>
            <span className="page-banner-label">About Us</span>
          </ScrollReveal>
          <ScrollReveal delay={1}>
            <h1 style={{ fontFamily: "var(--font-playfair)" }}>
              Our story, our <em>vision</em>
            </h1>
          </ScrollReveal>
          <ScrollReveal delay={2}>
            <p className="page-banner-desc">
              Founded on faith and sustained by grace, {branch?.name || "our church"} is a
              community dedicated to worship, discipleship, and service.
            </p>
          </ScrollReveal>
        </div>
      </section>

      <main className="flex flex-col h-full items-center">
        <div className="about-content w-full">
          <div className="about-inner">
            {/* Mission & Vision */}
            <ScrollReveal>
              <div className="mission-vision">
                <div className="mission-card">
                  <h3 style={{ fontFamily: "var(--font-playfair)" }}>Our Mission</h3>
                  <p>
                    To glorify God by making disciples of Jesus Christ through
                    faithful teaching, loving fellowship, and selfless service
                    to our community and beyond.
                  </p>
                </div>
                <div className="vision-card">
                  <h3 style={{ fontFamily: "var(--font-playfair)" }}>Our Vision</h3>
                  <p>
                    We envision a vibrant, Christ-centered church where every
                    believer is equipped to live out their faith and impact the
                    world for God&apos;s kingdom.
                  </p>
                  <ul className="vision-list">
                    <li>A house of prayer for all nations</li>
                    <li>Growing together in spiritual maturity</li>
                    <li>Loving our neighbours through tangible action</li>
                    <li>Raising the next generation of godly leaders</li>
                    <li>Reaching the unreached with the gospel</li>
                  </ul>
                </div>
              </div>
            </ScrollReveal>

            {/* Reverend Section */}
            {reverend && (
            <ScrollReveal>
              <div className="reverend-section">
                <div className="section-header">
                  <div>
                    <span className="section-label">Meet Our Minister</span>
                    <h2
                      className="section-title"
                      style={{ fontFamily: "var(--font-playfair)" }}
                    >
                      Shepherding with <em>heart</em>
                    </h2>
                  </div>
                </div>

                <div className="reverend-grid">
                  <div className="reverend-portrait">
                    <div className="reverend-portrait-card">
                      <div className="reverend-portrait-img">
                        {reverend.photo && <img src={reverend.photo} alt={reverend.name} />}
                      </div>
                      <h3 className="reverend-portrait-name" style={{ fontFamily: "var(--font-playfair)" }}>
                        Rev. {reverend.name}
                      </h3>
                      <p className="reverend-portrait-role">Lead Pastor</p>
                    </div>
                  </div>

                  <div className="reverend-content">
                    <h3 style={{ fontFamily: "var(--font-playfair)" }}>
                      Reverend {reverend.name}
                    </h3>
                    {bioParagraphs.map((paragraph, i) => (
                      <p key={i}>{paragraph}</p>
                    ))}
                  </div>
                </div>
              </div>
            </ScrollReveal>
            )}

            {/* Find Us Section */}
            <ScrollReveal>
              <div className="find-us-section">
                <div className="section-header">
                  <div>
                    <span className="section-label">Find Us</span>
                    <h2
                      className="section-title"
                      style={{ fontFamily: "var(--font-playfair)" }}
                    >
                      Join us <em>Sunday</em>
                    </h2>
                  </div>
                </div>

                <div className="find-us-grid">
                  <div className="map-placeholder">
                    {mapUrl && (
                      <a href={mapUrl} target="_blank" rel="noopener noreferrer">Open in Google Maps</a>
                    )}
                  </div>

                  <div className="contact-cards">
                    <div className="contact-info-card">
                      <p className="contact-info-label">📍 Address</p>
                      <p className="contact-info-value">{branch?.address}</p>
                    </div>
                    {services.length > 0 && (
                      <div className="contact-info-card">
                        <p className="contact-info-label">🕐 Service Times</p>
                        <p className="contact-info-value">
                          {services.map((s) => `${s.day} · ${formatTime(s.start_time)}`).join(" / ")}
                        </p>
                      </div>
                    )}
                    <div className="contact-info-card">
                      <p className="contact-info-label">📞 Contact</p>
                      <p className="contact-info-value">
                        {branch?.contact_phone && (
                          <a href={`tel:${branch.contact_phone.replace(/\s/g, "")}`}>{branch.contact_phone}</a>
                        )}
                        <br />
                        {branch?.contact_email && <a href={`mailto:${branch.contact_email}`}>{branch.contact_email}</a>}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </main>
    </div>
  );
}
