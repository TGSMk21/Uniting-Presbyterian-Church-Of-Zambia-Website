import { redirect } from "next/navigation";
import LoginForm from "@/components/DashboardComponents/login-form";
import { currentStaff } from "../session";

export default async function LoginPage() {
  const { status } = await currentStaff();
  if (status === 200) redirect("/dashboard");

  return (
    <main className="dash-center">
      <div className="dash-card">
        <img src="/logo.png" alt="" width="56" height="56" className="dash-card-logo" />
        <h1 className="dash-title">Staff sign in</h1>
        <p className="dash-text">Uniting Presbyterian Church In Zambia</p>
        <LoginForm />
      </div>
    </main>
  );
}
