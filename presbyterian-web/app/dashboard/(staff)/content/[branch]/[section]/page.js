import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getBranch } from "@/Services/api";
import { apiPath, isBranchSlug, isRowId, rowSummary, rowTitle, section } from "@/Utilities/branchContent.mjs";
import { requireStaff, staffRequest } from "../../../../session";

const SAVED = { added: "Added.", changed: "Saved.", deleted: "Deleted." };

export default async function SectionList({ params, searchParams }) {
  await requireStaff();
  const { branch, section: name } = await params;
  const spec = section(name);
  if (!spec || !isBranchSlug(branch)) notFound();
  const query = await searchParams;
  const page = isRowId(query.page) ? Number(query.page) : 1;
  const saved = Object.hasOwn(SAVED, query.saved ?? "") ? SAVED[query.saved] : null;

  // The API decides who can manage which branch; this page only asks it.
  const [{ status, data }, branchData] = await Promise.all([
    staffRequest(`${apiPath(branch, name)}?page=${page}`),
    getBranch(branch),
  ]);
  if (status === 401) redirect("/dashboard/login");
  if (status === 403 || status === 404) notFound();
  if (status !== 200) throw new Error(`The staff API answered ${status}`);

  const base = `/dashboard/content/${branch}/${name}`;
  const publicHref = spec.publicPath(branch);
  const rows = data.results || [];

  return (
    <main className="dash-main">
      <Link href="/dashboard/content" className="dash-link" prefetch={false}>← Branch content</Link>
      <h1 className="dash-heading dash-heading-spaced">{spec.label}</h1>
      <p className="dash-text">
        <strong>{branchData?.name || branch}.</strong> {spec.intro}
      </p>
      {saved && (
        <p className="dash-notice" role="status">
          {saved} <a href={publicHref} target="_blank" rel="noopener">View the page</a>
        </p>
      )}
      <div className="dash-toolbar">
        <Link href={`${base}/new`} className="btn-primary" prefetch={false}>{spec.adding}</Link>
        <a href={publicHref} target="_blank" rel="noopener" className="dash-link">View on the website</a>
      </div>

      {rows.length === 0 ? (
        <p className="dash-text">There are no {spec.label.toLowerCase()} yet.</p>
      ) : (
        <ul className="dash-rows">
          {rows.map((row) => (
            <li key={row.id}>
              <Link href={`${base}/${row.id}`} prefetch={false}>
                <span className="dash-row-title">{rowTitle(row)}</span>
                <span className="dash-row-meta">
                  {rowSummary(name, row)}
                  {row.is_live && <span className="dash-badge dash-badge-live">Live now</span>}
                  {row.is_hidden && <span className="dash-badge">Hidden</span>}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {(data.previous || data.next) && (
        <nav className="dash-pager" aria-label="More">
          {data.previous ? <Link href={`${base}?page=${page - 1}`} prefetch={false}>← Newer</Link> : <span />}
          <span>Page {page}</span>
          {data.next ? <Link href={`${base}?page=${page + 1}`} prefetch={false}>Older →</Link> : <span />}
        </nav>
      )}
    </main>
  );
}
