import { connection } from "next/server";
import { ScrollReveal } from "@/components/UniversalComponents/scroll-reveal";
import ContactForm from "@/components/UniversalComponents/contact-form";
import RichText from "@/components/UniversalComponents/rich-text";
import { getPageContent } from "@/Services/api";
import { pageFields, phoneHref } from "@/Utilities/pageContent.mjs";

export default async function ContactPage() {
  await connection();
  const content = await getPageContent("national");
  const f = pageFields("national", "contact", content?.pages?.contact);

  return (
    <main>
      <section className="page-banner">
        <div className="page-banner-inner">
          <span className="page-banner-label">{f.banner_label}</span>
          <h1 style={{ fontFamily: "var(--font-playfair)" }}>
            <RichText text={f.banner_title} />
          </h1>
          <p className="page-banner-desc">{f.banner_text}</p>
        </div>
      </section>

      <section className="contact-section">
        <div className="section-inner">
          <ScrollReveal>
            <div className="contact-cards nat-contact-cards">
              <div className="contact-info-card">
                <p className="contact-info-label">Email</p>
                <p className="contact-info-value">
                  <a href={`mailto:${f.email}`}>{f.email}</a>
                </p>
              </div>
              <div className="contact-info-card">
                <p className="contact-info-label">Phone</p>
                <p className="contact-info-value">
                  <a href={phoneHref(f.phone)}>{f.phone}</a>
                </p>
              </div>
              <div className="contact-info-card">
                <p className="contact-info-label">Office</p>
                <p className="contact-info-value">{f.office}</p>
              </div>
            </div>
          </ScrollReveal>

          <ScrollReveal>
            <div className="contact-card">
              <p className="contact-sub">{f.form_text}</p>
              <ContactForm />
            </div>
          </ScrollReveal>
        </div>
      </section>
    </main>
  );
}
