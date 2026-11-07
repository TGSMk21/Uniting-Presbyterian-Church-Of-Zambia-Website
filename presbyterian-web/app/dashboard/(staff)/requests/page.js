import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requestSummary } from "@/Utilities/accessRequests.mjs";
import { isRowId } from "@/Utilities/branchContent.mjs";
import { canManageStaff } from "@/Utilities/staffAdmin.mjs";
import { requireStaff, staffRequest } from "../../session";

const TABS = [
  { value: "waiting", label: "Waiting" },
  { value: "approved", label: "Approved" },
  { value: "turned_down", label: "Turned down" },
];

// Access requests (Task 7.2): superusers see all; a minister's account sees its branch's staff requests.
export default async function Requests({ searchParams }) {
  const staff = await requireStaff();
  if (!canManageStaff(staff)) notFound();
  const query = await searchParams;
  const tab = TABS.some(({ value }) => value === query.status) ? query.status : "waiting";
  const page = isRowId(query.page) ? Number(query.page) : 1;

  const { status, data } = await staffRequest(`/staff-requests/?status=${tab}&page=${page}`);
  if (status === 401) redirect("/dashboard/login");
  if (status === 403 || status === 404) notFound();
  if (status !== 200) throw new Error(`The staff API answered ${status}`);
  const rows = data.results || [];

  return (
    <main className="dash-main">
      <h1 className="dash-heading">Access requests</h1>
      <p className="dash-text">
        {staff.is_superuser
          ? "People asking for a dashboard account. You approve ministers; each branch's minister can also approve their own branch's other staff."
          : `Staff of ${staff.branch?.name} asking for a dashboard account. Ministers' requests go to the developer.`}
      </p>
      <nav className="dash-tabs" aria-label="Requests">
        {TABS.map(({ value, label }) => (
          <Link key={value} href={`/dashboard/requests?status=${value}`} prefetch={false} aria-current={value === tab ? "page" : undefined}>
            {label}
          </Link>
        ))}
      </nav>
      {rows.length === 0 ? (
        <p className="dash-text">{tab === "waiting" ? "Nobody is waiting." : "None yet."}</p>
      ) : (
        <ul className="dash-rows">
          {rows.map((row) => (
            <li key={row.id}>
              <Link href={`/dashboard/requests/${row.id}`} prefetch={false}>
                <span className="dash-row-title">{row.full_name}</span>
                <span className="dash-row-meta">{requestSummary(row)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {(data.previous || data.next) && (
        <nav className="dash-pager" aria-label="More">
          {data.previous ? <Link href={`/dashboard/requests?status=${tab}&page=${page - 1}`} prefetch={false}>← Newer</Link> : <span />}
          <span>Page {page}</span>
          {data.next ? <Link href={`/dashboard/requests?status=${tab}&page=${page + 1}`} prefetch={false}>Older →</Link> : <span />}
        </nav>
      )}
    </main>
  );
}
