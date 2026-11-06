import { connection } from "next/server";
import ChurchLocator from "@/components/LocatorComponents/church-locator";
import { getBranches } from "@/Services/api";

export const metadata = {
  title: "Find a Branch — Uniting Presbyterian Church In Zambia",
  description: "Find a Uniting Presbyterian Church branch near you, anywhere in Zambia.",
};

export default async function FindABranch() {
  // Render on request, not at build time: a build that misses the API would
  // publish an empty page. getBranches() still caches good answers for an hour.
  await connection();
  const data = await getBranches();

  return (
    <main>
      <section className="page-banner">
        <div className="page-banner-inner">
          <span className="page-banner-label">Find a Branch</span>
          <h1 style={{ fontFamily: "var(--font-playfair)" }}>
            There&apos;s a place for you <em>near you</em>
          </h1>
          <p className="page-banner-desc">
            Search by name or area, or find the branch closest to where you are.
          </p>
        </div>
      </section>

      <section className="loc-section">
        {data ? (
          <ChurchLocator branches={data.results} />
        ) : (
          <p className="nat-index-empty">
            We couldn&apos;t load the branches just now. Please refresh the page in a moment.
          </p>
        )}
      </section>
    </main>
  );
}
