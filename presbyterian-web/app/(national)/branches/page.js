import Link from "next/link";
import { ScrollReveal } from "@/components/UniversalComponents/scroll-reveal";
import { getBranches } from "@/Services/api";

export const revalidate = 3600;

export default async function BranchesDirectory() {
  const data = await getBranches();
  const branches = data?.results || [];

  return (
    <main>
      <section className="page-banner">
        <div className="page-banner-inner">
          <span className="page-banner-label">Our Branches</span>
          <h1 style={{ fontFamily: "var(--font-playfair)" }}>
            One church, <em>many homes</em>
          </h1>
          <p className="page-banner-desc">
            Find a branch of the Uniting Presbyterian Church In Zambia near you.
            Each one is a community ready to welcome you.
          </p>
        </div>
      </section>

      <section className="nat-branches">
        <div className="nat-branches-inner">
          <div className="nat-index">
            {branches.length === 0 && (
              <p className="nat-index-empty">No branches listed yet.</p>
            )}
            {branches.map((b, i) => (
              <ScrollReveal key={b.id} delay={(i % 3) + 1}>
                <Link href={`/${b.slug}`} className="nat-index-row">
                  <span className="nat-index-num">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="nat-index-main">
                    <span className="nat-index-name">{b.name}</span>
                    {b.address && (
                      <span className="nat-index-loc">{b.address}</span>
                    )}
                  </span>
                  <span className="nat-index-arrow" aria-hidden="true">
                    →
                  </span>
                </Link>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
