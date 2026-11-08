import SetPasswordForm from "@/components/DashboardComponents/set-password-form";
import CrestLogo from "@/components/UniversalComponents/crest-logo";

export const metadata = { title: "Choose your password" };

// Opened from the single-use link an approver sends (Task 7.2). The link's secret is
// after the # in the address, so it stays in the browser until the form sends it.
export default function SetPassword() {
  return (
    <main className="dash-center">
      <div className="dash-card">
        <CrestLogo className="dash-card-crest" />
        <h1 className="dash-title">Choose your password</h1>
        <SetPasswordForm />
      </div>
    </main>
  );
}
