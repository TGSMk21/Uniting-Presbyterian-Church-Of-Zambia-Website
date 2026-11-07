import Link from "next/link";
import { requireStaff } from "../session";

export default async function DashboardHome() {
  const staff = await requireStaff();

  return (
    <main className="dash-main">
      <h1 className="dash-heading">Welcome, {staff.name}</h1>
      <div className="dash-panel">
        <h2 className="dash-subheading">Your account</h2>
        <dl className="dash-details">
          <div>
            <dt>Username</dt>
            <dd>{staff.username}</dd>
          </div>
          <div>
            <dt>Role</dt>
            <dd>{staff.role_label}</dd>
          </div>
          <div>
            <dt>Branch</dt>
            <dd>{staff.branch?.name || "All branches"}</dd>
          </div>
          <div>
            <dt>Two-step login</dt>
            <dd>{staff.two_factor_enabled ? "On" : "Off"}</dd>
          </div>
        </dl>
        <div className="dash-links">
          <Link href="/dashboard/change-password" className="dash-link">
            Change your password
          </Link>
          {!staff.two_factor_enabled && (
            <Link href="/dashboard/two-factor" className="dash-link">
              Turn on two-step login
            </Link>
          )}
        </div>
      </div>
      <div className="dash-panel">
        <h2 className="dash-subheading">Manage the website</h2>
        <p className="dash-text">
          Change the wording and photos on your pages, and add sermons, projects and activities.
        </p>
        <div className="dash-links dash-links-spaced">
          <Link href="/dashboard/pages" className="dash-link" prefetch={false}>
            Go to Pages
          </Link>
          <Link href="/dashboard/content" className="dash-link" prefetch={false}>
            Go to Branch content
          </Link>
        </div>
      </div>
      <p className="dash-text">More sections will appear here as they&apos;re added.</p>
    </main>
  );
}
