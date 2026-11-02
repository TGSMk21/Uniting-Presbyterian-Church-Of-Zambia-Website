import { ScrollReveal } from "@/components/UniversalComponents/scroll-reveal";
import ContactForm from "@/components/UniversalComponents/contact-form";

export default function ContactPage() {
  return (
    <main>
      <section className="page-banner">
        <div className="page-banner-inner">
          <span className="page-banner-label">Contact Us</span>
          <h1 style={{ fontFamily: "var(--font-playfair)" }}>
            We&apos;d love to <em>hear</em> from you
          </h1>
          <p className="page-banner-desc">
            A question, a prayer request, or simply a hello — reach out and
            we&apos;ll be in touch.
          </p>
        </div>
      </section>

      <section className="contact-section">
        <div className="section-inner">
          <ScrollReveal>
            <div className="contact-cards nat-contact-cards">
              <div className="contact-info-card">
                <p className="contact-info-label">Email</p>
                <p className="contact-info-value">
                  <a href="mailto:hello@upcz.org">hello@upcz.org</a>
                </p>
              </div>
              <div className="contact-info-card">
                <p className="contact-info-label">Phone</p>
                <p className="contact-info-value">
                  <a href="tel:+260977681606">+260 977 681 606</a>
                </p>
              </div>
              <div className="contact-info-card">
                <p className="contact-info-label">Office</p>
                <p className="contact-info-value">National Office, Lusaka, Zambia</p>
              </div>
            </div>
          </ScrollReveal>

          <ScrollReveal>
            <div className="contact-card">
              <p className="contact-sub">
                Have a question, prayer request, or just want to say hello?
                Reach out to us.
              </p>
              <ContactForm />
            </div>
          </ScrollReveal>
        </div>
      </section>
    </main>
  );
}
