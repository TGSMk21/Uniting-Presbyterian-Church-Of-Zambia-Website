import Link from "next/link";
import CrestLogo from "@/components/UniversalComponents/crest-logo";
import { redirect } from "next/navigation";
import LoginForm from "@/components/DashboardComponents/login-form";
import { currentStaff } from "../session";

export default async function LoginPage() {
  const { status } = await currentStaff();
  if (status === 200) redirect("/dashboard");

  return (
    <main className="dash-center">
      <div className="dash-card">
        <CrestLogo className="dash-card-crest" />
        <h1 className="dash-title">Staff sign in</h1>
        <p className="dash-text">Uniting Presbyterian Church In Zambia</p>
        <LoginForm />
        <p className="dash-text dash-card-footer">
          New minister or branch staff? <Link href="/dashboard/request-access" prefetch={false}>Ask for access</Link>
        </p>
      </div>
    </main>
  );
}
