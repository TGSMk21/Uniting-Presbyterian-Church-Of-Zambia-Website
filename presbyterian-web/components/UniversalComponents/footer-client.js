'use client';
import Link from "next/link";

export default function FooterClient({ brand, links, contact }) {
  const year = new Date().getFullYear();
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div className="footer-top">
          <div>
            <Link href={brand.href} className="nav-brand" style={{ marginBottom: "0.5rem" }}>
              <img src={brand.logo || "/logo.png"} alt="Church logo" style={{ height: 88, width: "auto", maxWidth: 176, objectFit: "contain" }} />
              <div className="nav-title" style={{ color: "white" }}>
                {brand.name}
                {brand.sub && <span style={{ color: "rgba(255,255,255,0.6)" }}>{brand.sub}</span>}
              </div>
            </Link>
            <p className="footer-brand-desc">{brand.description}</p>
            <div className="footer-social">
              <a href="#" aria-label="Facebook">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
              </a>
              <a href="#" aria-label="YouTube">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                </svg>
              </a>
            </div>
          </div>

          <div>
            <div className="footer-col-title">Navigate</div>
            <ul className="footer-links">
              {links.map((l) => (
                <li key={l.href}><Link href={l.href}>{l.label}</Link></li>
              ))}
            </ul>
          </div>

          <div>
            <div className="footer-col-title">Church</div>
            <ul className="footer-links">
              <li><Link href={brand.href}>Home</Link></li>
              <li><Link href="/find-a-branch">Find a Branch</Link></li>
              <li><a href="#">Give</a></li>
            </ul>
          </div>

          <div>
            <div className="footer-col-title">Connect</div>
            <ul className="footer-links">
              <li><a href="#">Facebook</a></li>
              <li><a href="#">YouTube</a></li>
              {contact?.email && <li><a href={`mailto:${contact.email}`}>Email Us</a></li>}
              {contact?.phone && <li><a href={`tel:${contact.phone}`}>{contact.phone}</a></li>}
            </ul>
          </div>
        </div>

        <div className="footer-bottom">
          <div>Copyright &copy; {year} {brand.name}. All rights reserved.</div>
          <div><a href="#">Privacy</a> &middot; <a href="#">Terms</a></div>
        </div>
      </div>
    </footer>
  );
}
