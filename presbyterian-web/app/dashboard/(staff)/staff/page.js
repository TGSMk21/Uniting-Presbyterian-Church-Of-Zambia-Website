import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { isBranchSlug, isRowId } from "@/Utilities/branchContent.mjs";
import { canManageStaff, personSummary } from "@/Utilities/staffAdmin.mjs";
import { requireStaff, staffRequest } from "../../session";
import { allBranches } from "../../staff-data";

export default async function Staff({ searchParams }) {
  const staff = await requireStaff();
  if (!canManageStaff(staff)) notFound();
  const query = await searchParams;
  const page = isRowId(query.page) ? Number(query.page) : 1;
  const branch = staff.is_superuser && isBranchSlug(query.branch) ? query.branch : "";

  const filters = new URLSearchParams({ page: String(page), ...(branch && { branch }) });
  const [{ status, data }, branches] = await Promise.all([
    staffRequest(`/staff-people/?${filters}`),
    staff.is_superuser ? allBranches() : Promise.resolve([]),
  ]);
  if (status === 401) redirect("/dashboard/login");
  if (status === 403) notFound();
  if (status !== 200) throw new Error(`The staff API answered ${status}`);

  const people = data.results || [];
  const pageLink = (number) => `/dashboard/staff?${new URLSearchParams({ page: String(number), ...(branch && { branch }) })}`;

  return (
    <main className="dash-main">
      <h1 className="dash-heading">Staff</h1>
      <p className="dash-text">
        {staff.is_superuser
          ? "Everyone who can sign in to the dashboard. Superusers and finance roles are managed in the Django admin."
          : `${staff.branch.name}'s dashboard accounts. You can add, change and suspend content editors.`}
      </p>
      <div className="dash-toolbar">
        <Link href="/dashboard/staff/new" className="btn-primary" prefetch={false}>Add someone</Link>
      </div>
      {staff.is_superuser && (
        <form method="get" action="/dashboard/staff" className="dash-media-filters" role="search">
          <label className="dash-field">
            <span>Branch</span>
            <select name="branch" defaultValue={branch}>
              <option value="">All branches</option>
              {branches.map(({ slug, name }) => <option key={slug} value={slug}>{name}</option>)}
            </select>
          </label>
          <button type="submit" className="dash-quiet-button">Show</button>
        </form>
      )}
      {people.length === 0 ? (
        <p className="dash-text">No one yet.</p>
      ) : (
        <ul className="dash-rows">
          {people.map((person) => (
            <li key={person.id}>
              <Link href={`/dashboard/staff/${person.id}`} prefetch={false}>
                <span className="dash-row-title">
                  {[person.first_name, person.last_name].filter(Boolean).join(" ") || person.username}
                  {" "}<span className="dash-row-username">({person.username})</span>
                </span>
                <span className="dash-row-meta">{personSummary(person)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {(data.previous || data.next) && (
        <nav className="dash-pager" aria-label="More">
          {data.previous ? <Link href={pageLink(page - 1)} prefetch={false}>← Back</Link> : <span />}
          <span>Page {page}</span>
          {data.next ? <Link href={pageLink(page + 1)} prefetch={false}>More →</Link> : <span />}
        </nav>
      )}
    </main>
  );
}
