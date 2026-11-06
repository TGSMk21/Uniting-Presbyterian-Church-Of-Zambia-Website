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

// For signed-in pages. Sends people to sign-in, or to choose a new password if
// they still have a temporary one. An API outage shows the error page instead of
// signing them out.
export async function requireStaff({ allowTemporaryPassword = false } = {}) {
  const { status, data } = await currentStaff();
  if (status === 401 || status === 403) redirect("/dashboard/login");
  if (status !== 200) throw new Error(`The staff API answered ${status}`);
  if (data.must_change_password && !allowTemporaryPassword) redirect("/dashboard/change-password");
  return data;
}
