import BranchMap from "@/components/AboutComponents/branch-map";
import { ScrollReveal } from "@/components/UniversalComponents/scroll-reveal";
import RichText from "@/components/UniversalComponents/rich-text";
import { getBranch, getMinisters, getPageContent } from "@/Services/api";
import { listLines, pageFields } from "@/Utilities/pageContent.mjs";
import { branchMapView, directionsUrl } from "@/Utilities/churchLocator";
import { formatTime } from "@/Utilities/timeFormat";

export const revalidate = 3600;

export default async function About({ params }) {
  const { branch: branchSlug } = await params;
  const [branch, ministersData, content] = await Promise.all([
    getBranch(branchSlug),
    getMinisters(branchSlug),
    getPageContent(branchSlug),
  ]);
  const f = pageFields("branch", "about", content?.pages?.about, { branchName: branch?.name });
  const ministers = ministersData?.results || [];
  const reverend = ministers[0];
  const bioParagraphs = (reverend?.bio || "").split(/\n\s*\n/).filter(Boolean);
  const services = branch?.service_times || [];
  const mapView = branchMapView(branch);
  const mapUrl = branch && (mapView || branch.address) ? directionsUrl(branch) : null;
  return (
    <div className="container mx-auto max-w-full overflow-hidden min-w-full min-h-screen w-full">
      {/* Page Banner */}
      <section className="page-banner">
        <div className="page-banner-inner">
          <ScrollReveal>
            <span className="page-banner-label">{f.banner_label}</span>
          </ScrollReveal>
          <ScrollReveal delay={1}>
            <h1 style={{ fontFamily: "var(--font-playfair)" }}>
              <RichText text={f.banner_title} />
            </h1>
          </ScrollReveal>
          <ScrollReveal delay={2}>
            <p className="page-banner-desc">{f.banner_text}</p>
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
                  <h3 style={{ fontFamily: "var(--font-playfair)" }}>{f.mission_title}</h3>
                  <p>{f.mission_text}</p>
                </div>
                <div className="vision-card">
                  <h3 style={{ fontFamily: "var(--font-playfair)" }}>{f.vision_title}</h3>
                  <p>{f.vision_text}</p>
                  <ul className="vision-list">
                    {listLines(f.vision_list).map((point) => (
                      <li key={point}>{point}</li>
                    ))}
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
                    <span className="section-label">{f.minister_label}</span>
                    <h2
                      className="section-title"
                      style={{ fontFamily: "var(--font-playfair)" }}
                    >
                      <RichText text={f.minister_title} />
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
                      <p className="reverend-portrait-role">{f.minister_role}</p>
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
                    <span className="section-label">{f.find_label}</span>
                    <h2
                      className="section-title"
                      style={{ fontFamily: "var(--font-playfair)" }}
                    >
                      <RichText text={f.find_title} />
                    </h2>
                  </div>
                </div>

                <div className="find-us-grid">
                  {mapView ? (
                    <BranchMap name={branch.name} view={mapView} directionsHref={mapUrl} />
                  ) : (
                    <div className="map-placeholder">
                      {mapUrl && (
                        <a href={mapUrl} target="_blank" rel="noopener noreferrer">Open in Google Maps</a>
                      )}
                    </div>
                  )}

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
                    {(branch?.contact_phone || branch?.contact_email) && (
                      <div className="contact-info-card">
                        <p className="contact-info-label">📞 Contact</p>
                        <p className="contact-info-value">
                          {branch.contact_phone && (
                            <a href={`tel:${branch.contact_phone.replace(/\s/g, "")}`}>{branch.contact_phone}</a>
                          )}
                          {branch.contact_phone && branch.contact_email && <br />}
                          {branch.contact_email && <a href={`mailto:${branch.contact_email}`}>{branch.contact_email}</a>}
                        </p>
                      </div>
                    )}
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
