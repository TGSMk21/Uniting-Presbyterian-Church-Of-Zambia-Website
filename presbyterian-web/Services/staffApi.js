import { serverHeaders } from "@/Utilities/staffSession.mjs";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";
const TIMEOUT_MS = 15000;

// Server-side only: INTERNAL_API_SECRET must never reach the browser. Staff data
// is never cached. Returns { status, data }, with status 0 if the API can't be reached.
export async function staffFetch(path, { method = "GET", body, access, forwardedFor } = {}) {
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      method,
      headers: serverHeaders({ secret: process.env.INTERNAL_API_SECRET, forwardedFor, access }),
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    let data = null;
    try {
      data = await response.json();
    } catch {
      // Some answers, such as a lockout page, aren't JSON. The status is enough.
    }
    return { status: response.status, data };
  } catch (error) {
    console.error(`Staff API request failed: ${path}`, error);
    return { status: 0, data: null };
  }
}
