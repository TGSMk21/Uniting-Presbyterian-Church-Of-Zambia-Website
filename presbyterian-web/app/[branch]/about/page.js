import { ScrollReveal } from "@/components/UniversalComponents/scroll-reveal";
import { getBranch, getMinisters } from "@/Services/api";

export const revalidate = 3600;

export default async function About({ params }) {
  const { branch: branchSlug } = await params;
  const [branch, ministersData] = await Promise.all([
    getBranch(branchSlug),
    getMinisters(branchSlug),
  ]);
  const ministers = ministersData?.results || [];
  const reverend = ministers[0];
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
              Founded on faith and sustained by grace, we are a community
              dedicated to worship, discipleship, and service in the heart of
              Lusaka.
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
                        {reverend?.photo ? (
                          <img src={reverend.photo} alt={reverend.name} />
                        ) : (
                          <img src="https://image.qwenlm.ai/public_source/e3258763-8dd2-46cd-885c-0b3ea5625da5/161c29b4b-9d82-407c-b9f2-c95a6d7a8506.png" alt="Rev. Thomson Mkandawire" />
                        )}
                      </div>
                      <h3 className="reverend-portrait-name" style={{ fontFamily: "var(--font-playfair)" }}>
                        {reverend ? `Rev. ${reverend.name}` : 'Rev. Thomson Mkandawire'}
                      </h3>
                      <p className="reverend-portrait-role">Lead Pastor</p>
                    </div>
                  </div>

                  <div className="reverend-content">
                    <h3 style={{ fontFamily: "var(--font-playfair)" }}>
                      {reverend ? `Reverend ${reverend.name}` : 'Reverend Thomson Mkandawire'}
                    </h3>
                    <p>{reverend?.bio || 'Reverend Thomson Mkandawire is a dedicated servant of God whose pastoral journey began over fifteen years ago. He was called to ministry with a deep conviction to preach the Word, disciple believers, and extend the love of Christ to the lost and the hurting.'}</p>
                    <p>After completing his theological training, he served in several congregations across Lusaka before being appointed as Lead Pastor at Freedom Presbyterian Church. His leadership is marked by a heart for worship, expository preaching, and community transformation.</p>
                    <p>Reverend Mkandawire is married and is passionate about youth mentorship, theological education, and building bridges between the church and the wider community. He continues to serve with humility, wisdom, and an unwavering commitment to the gospel.</p>

                    <div className="credentials">
                      <h4 style={{ fontFamily: "var(--font-playfair)" }}>Ministry Credentials &amp; Achievements</h4>
                      <div className="credential-item"><div className="credential-check">✓</div><span className="credential-text">Master of Divinity — University of Zambia</span></div>
                      <div className="credential-item"><div className="credential-check">✓</div><span className="credential-text">15+ years of pastoral leadership</span></div>
                      <div className="credential-item"><div className="credential-check">✓</div><span className="credential-text">Founded the Youth Education Fund initiative</span></div>
                      <div className="credential-item"><div className="credential-check">✓</div><span className="credential-text">CCAP Ordained Minister · Presbytery of Lusaka</span></div>
                    </div>
                  </div>
                </div>
              </div>
            </ScrollReveal>

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
                    <span>Map placeholder</span>
                  </div>

                  <div className="contact-cards">
                    <div className="contact-info-card">
                      <p className="contact-info-label">📍 Address</p>
                      <p className="contact-info-value">{branch?.address || 'Freedom Compound, Chilanga, Lusaka, Zambia'}</p>
                    </div>
                    <div className="contact-info-card">
                      <p className="contact-info-label">🕐 Service Times</p>
                      <p className="contact-info-value">Sunday · 9:00 AM / Wednesday · 4:30 PM</p>
                    </div>
                    <div className="contact-info-card">
                      <p className="contact-info-label">📞 Contact</p>
                      <p className="contact-info-value">
                        <a href={`tel:${branch?.contact_phone || '+260211234567'}`}>{branch?.contact_phone || '+260 21 123 4567'}</a>
                        <br />
                        <a href={`mailto:${branch?.contact_email || 'info@freedompresbyterian.org'}`}>{branch?.contact_email || 'info@freedompresbyterian.org'}</a>
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
