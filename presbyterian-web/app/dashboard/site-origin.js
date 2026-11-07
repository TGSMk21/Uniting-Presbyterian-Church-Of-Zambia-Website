import { headers } from "next/headers";

// This website's own address, for set-password links (Task 7.2). Server-side only.
export async function siteOrigin() {
  const list = await headers();
  const host = list.get("x-forwarded-host") || list.get("host");
  const proto = list.get("x-forwarded-proto") || (host?.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
