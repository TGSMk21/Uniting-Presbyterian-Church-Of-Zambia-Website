import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import TwoFactorSetupForm from "@/components/DashboardComponents/two-factor-setup-form";
import { staffFetch } from "@/Services/staffApi";
import { ACCESS_COOKIE } from "@/Utilities/staffSession.mjs";
import { requireStaff } from "../session";

export default async function TwoFactorPage() {
  const staff = await requireStaff({ allowTwoFactorSetUp: true });

  // No redirect when it's already on. Turning it on refreshes this page, and
  // redirecting then would lose the recovery codes before they could be read.
  let details = null;
  if (!staff.two_factor_enabled) {
    const { status, data } = await staffFetch("/auth/two-factor/setup/", {
      access: (await cookies()).get(ACCESS_COOKIE)?.value,
      forwardedFor: (await headers()).get("x-forwarded-for"),
    });
    if (status === 401 || status === 403) redirect("/dashboard/login");
    if (status !== 200 && status !== 409) throw new Error(`The staff API answered ${status}`);
    if (status === 200) details = data;
  }

  return (
    <main className="dash-center">
      <div className="dash-card">
        <TwoFactorSetupForm qrCode={details?.qr_code} secretKey={details?.key} />
      </div>
    </main>
  );
}
