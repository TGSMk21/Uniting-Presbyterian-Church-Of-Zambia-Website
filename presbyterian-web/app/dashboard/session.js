import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { staffFetch } from "@/Services/staffApi";
import { ACCESS_COOKIE } from "@/Utilities/staffSession.mjs";

// Who's signed in, asked of the API once per page render: { status, data }.
export const currentStaff = cache(async () => {
  const access = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (!access) return { status: 401, data: null };
  const forwardedFor = (await headers()).get("x-forwarded-for");
  return staffFetch("/auth/me/", { access, forwardedFor });
});

// A call to the API as the person signed in.
export async function staffRequest(path, options = {}) {
  const access = (await cookies()).get(ACCESS_COOKIE)?.value;
  const forwardedFor = (await headers()).get("x-forwarded-for");
  return staffFetch(path, { ...options, access, forwardedFor });
}

// For signed-in pages. Sends people to sign-in, or to finish their first-time steps
// (a new password, then two-step login). An API outage shows the error page
// instead of signing them out.
export async function requireStaff({ allowTemporaryPassword = false, allowTwoFactorSetUp = false } = {}) {
  const { status, data } = await currentStaff();
  if (status === 401 || status === 403) redirect("/dashboard/login");
  if (status !== 200) throw new Error(`The staff API answered ${status}`);
  if (data.must_change_password && !allowTemporaryPassword) redirect("/dashboard/change-password");
  if (data.must_set_up_two_factor && !allowTemporaryPassword && !allowTwoFactorSetUp) redirect("/dashboard/two-factor");
  return data;
}
