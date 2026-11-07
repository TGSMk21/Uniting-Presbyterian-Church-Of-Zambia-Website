'use client';
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";

export default function NavClient({ brand, links }) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const isActive = (href) => pathname === href;

  useEffect(() => {
    document.body.style.overflow = drawerOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [drawerOpen]);

  const closeDrawer = () => setDrawerOpen(false);

  return (
    <>
      <nav className="nav">
        <div className="nav-inner">
          <Link href={brand.href} className="nav-brand">
            <img src={brand.logo || "/logo.png"} alt="Church logo" style={{ height: 80, width: "auto", maxWidth: 160, objectFit: "contain" }} />
            <div className="nav-title">
              {brand.name}
              {brand.sub && <span>{brand.sub}</span>}
            </div>
          </Link>

          <ul className="nav-links">
            {links.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className={isActive(l.href) ? "active" : ""}>{l.label}</Link>
              </li>
            ))}
          </ul>

          <button className="nav-toggle" onClick={() => setDrawerOpen(true)} aria-label="Open menu">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="3" y1="6" x2="21" y2="6"/>
              <line x1="3" y1="12" x2="21" y2="12"/>
              <line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>
        </div>
      </nav>

      <div className={`drawer-overlay ${drawerOpen ? "open" : ""}`} onClick={closeDrawer} />
      <aside className={`drawer ${drawerOpen ? "open" : ""}`}>
        <div className="drawer-header">
          <div className="nav-title" style={{ color: "white" }}>
            {brand.name}
            {brand.sub && <span style={{ color: "rgba(255,255,255,0.6)" }}>{brand.sub}</span>}
          </div>
          <button className="drawer-close" onClick={closeDrawer} aria-label="Close menu">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <ul className="drawer-links">
          {links.map((l) => (
            <li key={l.href}><Link href={l.href} onClick={closeDrawer}>{l.label}</Link></li>
          ))}
        </ul>
      </aside>
    </>
  );
}
