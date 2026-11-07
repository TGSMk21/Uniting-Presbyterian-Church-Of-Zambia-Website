import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import CodeForm from "@/components/DashboardComponents/code-form";
import { CHALLENGE_COOKIE } from "@/Utilities/staffSession.mjs";

export default async function VerifyPage() {
  if (!(await cookies()).get(CHALLENGE_COOKIE)?.value) redirect("/dashboard/login");

  return (
    <main className="dash-center">
      <div className="dash-card">
        <h1 className="dash-title">Enter your code</h1>
        <p className="dash-text">Open your authenticator app and enter the 6-digit code for UPCZ Staff.</p>
        <CodeForm />
        <Link href="/dashboard/login" className="dash-back">
          Start again
        </Link>
      </div>
    </main>
  );
}
