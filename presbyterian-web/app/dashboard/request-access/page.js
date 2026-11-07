import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import RequestAccessForm from "@/components/DashboardComponents/request-access-form";
import { getBranches } from "@/Services/api";
import { currentStaff } from "../session";

export const metadata = { title: "Ask for access" };

// For ministers and branch staff without an account (Task 7.2). Nothing here needs a session.
export default async function RequestAccess() {
  // The branch list comes fresh on each visit, never frozen at build time.
  await connection();
  const { status } = await currentStaff();
  if (status === 200) redirect("/dashboard");
  const branches = ((await getBranches())?.results || []).map(({ slug, name }) => ({ slug, name }));

  return (
    <main className="dash-center">
      <div className="dash-card dash-card-wide">
        <img src="/logo.png" alt="" width="56" height="56" className="dash-card-logo" />
        <h1 className="dash-title">Ask for access</h1>
        <p className="dash-text">
          For ministers and staff of a UPCZ branch. Once your request is approved, you&apos;ll be sent a link to choose
          your password.
        </p>
        <RequestAccessForm branches={branches} />
        <p className="dash-text dash-card-footer">
          Already have an account? <Link href="/dashboard/login" prefetch={false}>Sign in</Link>
        </p>
      </div>
    </main>
  );
}
