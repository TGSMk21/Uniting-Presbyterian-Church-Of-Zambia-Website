import { serverHeaders } from "@/Utilities/staffSession.mjs";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

// A person's private meeting calendar for their phone (Task 8.3, A7). The secret in the
// address is the only key, so it is checked for shape here and matched by the API.
export async function GET(request, { params }) {
  const { file } = await params;
  const match = /^([A-Za-z0-9_-]{20,64})\.ics$/.exec(file ?? "");
  if (!match) return new Response("Not found", { status: 404 });
  let response;
  try {
    response = await fetch(`${API_BASE}/workspace/calendar/${match[1]}.ics`, {
      headers: serverHeaders({ secret: process.env.INTERNAL_API_SECRET, json: false }),
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    return new Response("The calendar couldn't be reached just now.", { status: 503 });
  }
  if (response.status !== 200) return new Response("Not found", { status: 404 });
  return new Response(await response.text(), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Cache-Control": "private, no-store",
      "Referrer-Policy": "no-referrer",
    },
  });
}
