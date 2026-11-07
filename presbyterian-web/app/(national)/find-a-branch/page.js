import { connection } from "next/server";
import ChurchLocator from "@/components/LocatorComponents/church-locator";
import RichText from "@/components/UniversalComponents/rich-text";
import { getBranches, getPageContent } from "@/Services/api";
import { pageFields } from "@/Utilities/pageContent.mjs";

export const metadata = {
  title: "Find a Branch — Uniting Presbyterian Church In Zambia",
  description: "Find a Uniting Presbyterian Church branch near you, anywhere in Zambia.",
};

export default async function FindABranch() {
  // Render on request, not at build time: a build that misses the API would
  // publish an empty page. getBranches() still caches good answers for an hour.
  await connection();
  const [data, content] = await Promise.all([getBranches(), getPageContent("national")]);
  const f = pageFields("national", "find-a-branch", content?.pages?.["find-a-branch"]);

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
