import Link from "next/link";
import PasswordForm from "@/components/DashboardComponents/password-form";
import { requireStaff } from "../session";

export default async function ChangePasswordPage() {
  const staff = await requireStaff({ allowTemporaryPassword: true });
  const required = staff.must_change_password;

  return (
    <main className="dash-center">
      <div className="dash-card">
        <h1 className="dash-title">{required ? "Choose a new password" : "Change your password"}</h1>
        <p className="dash-text">
          {required
            ? "You're using a temporary password. Choose your own before continuing."
            : "This will sign you out on your other devices."}
        </p>
        <PasswordForm />
        {!required && (
          <Link href="/dashboard" className="dash-back">
            Back to the dashboard
          </Link>
        )}
      </div>
    </main>
  );
}
