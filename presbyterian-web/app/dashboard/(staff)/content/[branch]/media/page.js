import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import MediaUpload from "@/components/DashboardComponents/media-upload";
import { getBranch } from "@/Services/api";
import { isBranchSlug } from "@/Utilities/branchContent.mjs";
import { exportHref } from "@/Utilities/csvExport.mjs";
import { MEDIA_TYPES, mediaQuery, mediaSummary } from "@/Utilities/mediaLibrary.mjs";
import { requireStaff, staffRequest } from "../../../../session";

const SAVED = { added: "Added.", changed: "Saved.", deleted: "Deleted." };

export default async function MediaLibrary({ params, searchParams }) {
  await requireStaff();
  const { branch } = await params;
  if (!isBranchSlug(branch)) notFound();
  const query = await searchParams;
  const saved = Object.hasOwn(SAVED, query.saved ?? "") ? SAVED[query.saved] : null;
  const filters = mediaQuery(query);
  const current = new URLSearchParams(filters.slice(1));
  const page = Number(current.get("page"));

  // The API decides who can manage which branch; this page only asks it.
  const base = `/staff/${encodeURIComponent(branch)}/media/`;
  const [{ status, data }, tags, branchData] = await Promise.all([
    staffRequest(`${base}${filters}`),
    staffRequest(`${base}tags/`),
    getBranch(branch),
  ]);
  if (status === 401) redirect("/dashboard/login");
  if (status === 403 || status === 404) notFound();
  if (status !== 200) throw new Error(`The staff API answered ${status}`);

  const rows = data.results || [];
  const tagNames = Array.isArray(tags.data) ? tags.data : [];
  const filtered = current.has("type") || current.has("tag") || current.has("q");
  const here = `/dashboard/content/${branch}/media`;
  const pageLink = (number) => {
    const next = new URLSearchParams(current);
    next.set("page", String(number));
    return `${here}?${next}`;
  };

  return (
    <main className="dash-main">
      <Link href="/dashboard/content" className="dash-link" prefetch={false}>← Branch content</Link>
      <h1 className="dash-heading dash-heading-spaced">Media library</h1>
      <p className="dash-text">
        <strong>{branchData?.name || branch}.</strong> Photos, documents and recordings for your branch&apos;s staff.
        They aren&apos;t shown on the website, and links to them stop working after an hour.
      </p>
      {saved && <p className="dash-notice" role="status">{saved}</p>}

      <MediaUpload branch={branch} />

      <form method="get" action={here} className="dash-media-filters" role="search">
        <label className="dash-field">
          <span>Kind</span>
          <select name="type" defaultValue={current.get("type") || ""}>
            {MEDIA_TYPES.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        {tagNames.length > 0 && (
          <label className="dash-field">
            <span>Tag</span>
            <select name="tag" defaultValue={current.get("tag") || ""}>
              <option value="">Any tag</option>
              {tagNames.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
          </label>
        )}
        <label className="dash-field">
          <span>Words</span>
          <input type="search" name="q" defaultValue={current.get("q") || ""} maxLength={100} />
        </label>
        <button type="submit" className="dash-quiet-button">Show</button>
        {filtered && <Link href={here} className="dash-link" prefetch={false}>Show everything</Link>}
      </form>
      {rows.length > 0 && (
        <p className="dash-text">
          <a href={exportHref(branch, "media", filters)} className="dash-link" download>
            Download this list as a spreadsheet (CSV)
          </a>
        </p>
      )}

      {rows.length === 0 ? (
        <p className="dash-text">{filtered ? "No files match." : "There are no files yet."}</p>
      ) : (
        <ul className="dash-rows dash-media-rows">
          {rows.map((row) => (
            <li key={row.id}>
              <div className="dash-media-row">
                {row.file_type === "image" ? (
                  // Signed links expire, so the image optimiser can't cache these.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={row.url} alt="" className="dash-media-thumb" loading="lazy" />
                ) : (
                  <span className="dash-media-thumb dash-media-kind" aria-hidden="true">{row.kind}</span>
                )}
                <span className="dash-media-text">
                  <Link href={`${here}/${row.id}`} prefetch={false} className="dash-row-title">{row.title}</Link>
                  <span className="dash-row-meta">{mediaSummary(row)}</span>
                </span>
                <a href={row.url} target="_blank" rel="noopener noreferrer" className="dash-link">
                  Open<span className="visually-hidden"> {row.title}</span>
                </a>
              </div>
            </li>
          ))}
        </ul>
      )}

      {(data.previous || data.next) && (
        <nav className="dash-pager" aria-label="More">
          {data.previous ? <Link href={pageLink(page - 1)} prefetch={false}>← Newer</Link> : <span />}
          <span>Page {page}</span>
          {data.next ? <Link href={pageLink(page + 1)} prefetch={false}>Older →</Link> : <span />}
        </nav>
      )}
    </main>
  );
}
