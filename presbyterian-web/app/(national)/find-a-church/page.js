import ChurchLocator from "@/components/LocatorComponents/church-locator";
import { getBranches } from "@/Services/api";

export const revalidate = 3600;

export const metadata = {
  title: "Find a Church — Uniting Presbyterian Church In Zambia",
  description: "Find a Uniting Presbyterian Church branch near you, anywhere in Zambia.",
};

export default async function FindAChurch() {
  const data = await getBranches();
  const branches = data?.results || [];

  return (
    <main>
      <section className="page-banner">
        <div className="page-banner-inner">
          <span className="page-banner-label">Find a Church</span>
          <h1 style={{ fontFamily: "var(--font-playfair)" }}>
            There&apos;s a place for you <em>near you</em>
          </h1>
          <p className="page-banner-desc">
            Search by name or area, or find the branch closest to where you are.
          </p>
        </div>
      </section>

      <section className="loc-section">
        <ChurchLocator branches={branches} />
      </section>
    </main>
  );
}
