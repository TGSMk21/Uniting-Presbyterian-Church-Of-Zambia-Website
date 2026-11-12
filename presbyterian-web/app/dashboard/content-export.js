import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";
import { staffDownload } from "@/Services/staffApi";
import { ACCESS_COOKIE } from "@/Utilities/staffSession.mjs";
import { exportApiPath, safeDisposition } from "@/Utilities/csvExport.mjs";
import { currentStaff } from "./session";

// A section's rows as a CSV file, passed on from the API. Used by the export routes.
// Every download first checks who is signed in. Answers a response to send instead, or
// null when the download may go ahead.
export async function downloadGate(request) {
  const toPage = (path) => NextResponse.redirect(new URL(path, request.url));
  const { status: who, data: staff } = await currentStaff();
  if (who === 401 || who === 403) return toPage("/dashboard/login");
  if (who !== 200) return new NextResponse("The dashboard can't be reached right now.", { status: 503 });
  // People finishing their first sign-in steps can't download anything yet.
  if (staff.must_change_password || staff.must_set_up_two_factor) return toPage("/dashboard");
  return null;
}

export async function exportResponse(request, branch, section) {
  const toPage = (path) => NextResponse.redirect(new URL(path, request.url));
  const stop = await downloadGate(request);
  if (stop) return stop;

  const path = exportApiPath(branch, section, Object.fromEntries(request.nextUrl.searchParams));
  if (!path) return new NextResponse("Not found", { status: 404 });

  const access = (await cookies()).get(ACCESS_COOKIE)?.value;
  const forwardedFor = (await headers()).get("x-forwarded-for");
  const { status, body, disposition } = await staffDownload(path, { access, forwardedFor });
  if (status === 401) return toPage("/dashboard/login");
  if (status === 403 || status === 404) return new NextResponse("Not found", { status: 404 });
  if (status !== 200) return new NextResponse("The file couldn't be made right now. Please try again.", { status: 503 });

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": safeDisposition(disposition),
      "Cache-Control": "no-store",
    },
  });
}
