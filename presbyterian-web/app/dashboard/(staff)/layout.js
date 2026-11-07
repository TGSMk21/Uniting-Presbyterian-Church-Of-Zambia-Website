import Link from "next/link";
import { signOut } from "../actions";
import { requireStaff } from "../session";

export default async function StaffLayout({ children }) {
  const staff = await requireStaff();

  return (
    <>
      <header className="dash-header">
        <Link href="/dashboard" className="dash-brand" prefetch={false}>
          <img src="/logo.png" alt="" width="32" height="32" />
          <span>Staff Dashboard</span>
        </Link>
        <nav className="dash-nav" aria-label="Dashboard">
          <Link href="/dashboard" prefetch={false}>Overview</Link>
          <Link href="/dashboard/pages" prefetch={false}>Pages</Link>
          <Link href="/dashboard/content" prefetch={false}>Branch content</Link>
        </nav>
        <div className="dash-account">
          <span className="dash-account-name">{staff.name}</span>
          <form action={signOut}>
            <button type="submit" className="dash-signout">Sign out</button>
          </form>
        </div>
      </header>
      {children}
    </>
  );
}
