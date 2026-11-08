import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getBranch } from "@/Services/api";
import { apiPath, isBranchSlug, listQuery, rowBadges, rowSummary, rowTitle, section } from "@/Utilities/branchContent.mjs";
import { exportHref } from "@/Utilities/csvExport.mjs";
import { requireStaff, staffRequest } from "../../../../session";

const SAVED = { added: "Added.", changed: "Saved.", deleted: "Deleted." };

export default async function SectionList({ params, searchParams }) {
  await requireStaff();
  const { branch, section: name } = await params;
  const spec = section(name);
  if (!spec || !isBranchSlug(branch)) notFound();
  const query = await searchParams;
  // Only listed statuses and sorts go into the address.
  const { page, status: filter, sort, api, keep } = listQuery(name, query);
  const saved = Object.hasOwn(SAVED, query.saved ?? "") ? SAVED[query.saved] : null;

  // The API decides who can manage which branch; this page only asks it.
  const [{ status, data }, branchData] = await Promise.all([
    staffRequest(`${apiPath(branch, name)}${api}`),
    getBranch(branch),
  ]);
  if (status === 401) redirect("/dashboard/login");
  if (status === 403 || status === 404) notFound();
  if (status !== 200) throw new Error(`The staff API answered ${status}`);

  const base = `/dashboard/content/${branch}/${name}`;
  // Private sections, such as written sermons, aren't on the website.
  const publicHref = spec.publicPath ? spec.publicPath(branch) : null;
  const rows = data.results || [];
  const link = (extra) => {
    const params = new URLSearchParams(keep);
    for (const [key, value] of Object.entries(extra)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    const text = params.toString();
    return text ? `${base}?${text}` : base;
  };

  return (
    <main className="dash-main">
      <Link href="/dashboard/content" className="dash-link" prefetch={false}>← Branch content</Link>
      <h1 className="dash-heading dash-heading-spaced">{spec.label}</h1>
      <p className="dash-text">
        <strong>{branchData?.name || branch}.</strong> {spec.intro}
      </p>
      {saved && (
        <p className="dash-notice" role="status">
          {saved} {publicHref && <a href={publicHref} target="_blank" rel="noopener">View the page</a>}
        </p>
      )}
      <div className="dash-toolbar">
        <Link href={`${base}/new`} className="btn-primary" prefetch={false}>{spec.adding}</Link>
        {spec.uploads && <Link href={`${base}/upload`} className="btn-ghost" prefetch={false}>Add files</Link>}
        {publicHref && <a href={publicHref} target="_blank" rel="noopener" className="dash-link">View on the website</a>}
        {rows.length > 0 && (
          <a href={exportHref(branch, name)} className="dash-link" download>Download as a spreadsheet (CSV)</a>
        )}
      </div>

      {spec.filters && (
        <nav className="dash-tabs" aria-label={`${spec.label} by status`}>
          {spec.filters.map(({ value, label }) => (
            <Link key={value || "all"} href={link({ status: value })} prefetch={false}
              aria-current={value === filter ? "page" : undefined}>
              {label}
            </Link>
          ))}
        </nav>
      )}

      {spec.sorts && rows.length > 1 && (
        <form method="get" action={base} className="dash-sort">
          {filter && <input type="hidden" name="status" value={filter} />}
          <label>
            <span>Sort</span>
            <select name="sort" defaultValue={sort}>
              {spec.sorts.map(({ value, label }) => <option key={value || "usual"} value={value}>{label}</option>)}
            </select>
          </label>
          <button type="submit" className="dash-quiet-button">Apply</button>
        </form>
      )}

      {rows.length === 0 && filter ? (
        <p className="dash-text">None here.</p>
      ) : rows.length === 0 ? (
        <div className="dash-empty">
          <p className="dash-subheading">No {spec.label.toLowerCase()} yet</p>
          <p className="dash-text">When you add one, it appears here.</p>
          <Link href={`${base}/new`} className="btn-primary" prefetch={false}>{spec.adding}</Link>
        </div>
      ) : (
        <ul className="dash-rows">
          {rows.map((row) => (
            <li key={row.id}>
              <Link href={`${base}/${row.id}`} prefetch={false}>
                <span className="dash-row-title">{rowTitle(row)}</span>
                <span className="dash-row-meta">
                  {rowBadges(name, row).map(({ text, tone }) => (
                    <span key={text} className={`dash-badge dash-badge-${tone}`}>{text}</span>
                  ))}
                  {rowSummary(name, row)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {(data.previous || data.next) && (
        <nav className="dash-pager" aria-label="More">
          {data.previous ? <Link href={link({ page: String(page - 1) })} prefetch={false}>← Previous</Link> : <span />}
          <span>Page {page}</span>
          {data.next ? <Link href={link({ page: String(page + 1) })} prefetch={false}>Next →</Link> : <span />}
        </nav>
      )}
    </main>
  );
}
