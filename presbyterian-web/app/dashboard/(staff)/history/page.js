import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { HISTORY_SECTIONS, changeSummary, historyQuery } from "@/Utilities/staffAdmin.mjs";
import { requireStaff, staffRequest } from "../../session";
import { allBranches } from "../../staff-data";

function when(value) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Lusaka", weekday: "short", day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).format(new Date(value));
}

export default async function History({ searchParams }) {
  const staff = await requireStaff();
  if (!staff.is_superuser) notFound();
  const filters = historyQuery(await searchParams);
  const current = new URLSearchParams(filters.slice(1));
  const page = Number(current.get("page"));

  const [{ status, data }, branches] = await Promise.all([
    staffRequest(`/staff-changes/${filters}`),
    allBranches(),
  ]);
  if (status === 401) redirect("/dashboard/login");
  if (status === 403) notFound();
  if (status !== 200) throw new Error(`The staff API answered ${status}`);

  const rows = data.results || [];
  const filtered = current.has("branch") || current.has("person") || current.has("section");
  const pageLink = (number) => {
    const next = new URLSearchParams(current);
    next.set("page", String(number));
    return `/dashboard/history?${next}`;
  };

  return (
    <main className="dash-main">
      <h1 className="dash-heading">Change history</h1>
      <p className="dash-text">
        Every change made in this dashboard: who, what and when. Changes made in the Django admin are in its own history.
      </p>
      <form method="get" action="/dashboard/history" className="dash-media-filters" role="search">
        <label className="dash-field">
          <span>Branch</span>
          <select name="branch" defaultValue={current.get("branch") || ""}>
            <option value="">All branches</option>
            {branches.map(({ slug, name }) => <option key={slug} value={slug}>{name}</option>)}
          </select>
        </label>
        <label className="dash-field">
          <span>Section</span>
          <select name="section" defaultValue={current.get("section") || ""}>
            <option value="">Everything</option>
            {HISTORY_SECTIONS.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label className="dash-field">
          <span>Username</span>
          <input type="search" name="person" defaultValue={current.get("person") || ""} maxLength={150} />
        </label>
        <button type="submit" className="dash-quiet-button">Show</button>
        {filtered && <Link href="/dashboard/history" className="dash-link" prefetch={false}>Show everything</Link>}
      </form>

      {rows.length === 0 ? (
        <p className="dash-text">{filtered ? "No changes match." : "No changes yet."}</p>
      ) : (
        <ol className="dash-history">
          {rows.map((entry) => (
            <li key={entry.id}>
              <span className="dash-history-what">{changeSummary(entry)}</span>
              <span className="dash-row-meta">
                {when(entry.at)}
                {entry.branch_name ? ` · ${entry.branch_name}` : " · National"}
              </span>
            </li>
          ))}
        </ol>
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
