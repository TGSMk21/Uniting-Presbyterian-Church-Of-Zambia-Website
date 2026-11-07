import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "../../session";
import { allBranches } from "../../staff-data";

export default async function Branches() {
  const staff = await requireStaff();
  if (!staff.is_superuser) notFound();
  const branches = await allBranches();

  return (
    <main className="dash-main">
      <h1 className="dash-heading">Branches</h1>
      <p className="dash-text">
        Add a branch, rename it, set its YouTube channel, or take it off the website. Its own staff change everything
        else from Branch content.
      </p>
      <div className="dash-toolbar">
        <Link href="/dashboard/branches/new" className="btn-primary" prefetch={false}>Add a branch</Link>
      </div>
      <ul className="dash-rows">
        {branches.map((branch) => (
          <li key={branch.slug}>
            <Link href={`/dashboard/branches/${branch.slug}`} prefetch={false}>
              <span className="dash-row-title">{branch.name}</span>
              <span className="dash-row-meta">
                /{branch.slug} · {branch.staff_count === 1 ? "1 staff account" : `${branch.staff_count} staff accounts`}
                {!branch.youtube_channel_id && " · No YouTube channel"}
                {!branch.is_active && <span className="dash-badge">Not on the website</span>}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
