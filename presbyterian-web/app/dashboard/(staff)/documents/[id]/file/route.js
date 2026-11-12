import { cookies, headers } from "next/headers";
import { ACCESS_COOKIE, serverHeaders } from "@/Utilities/staffSession.mjs";
import { isRowId } from "@/Utilities/workspace.mjs";
import { downloadGate } from "../../../../content-export";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";
const PASSED_ON = ["Content-Type", "Content-Disposition", "Content-Length"];

// A shared document's file (Task 8.5), streamed from the API after its access check,
// so files never get a public or lasting address.
export async function GET(request, { params }) {
  const stop = await downloadGate(request);
  if (stop) return stop;
  const { id } = await params;
  const version = new URL(request.url).searchParams.get("version");
  if (!isRowId(id) || (version !== null && !isRowId(version))) return new Response("Not found", { status: 404 });
  const access = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (!access) return new Response("Please sign in again.", { status: 401 });
  let answer;
  try {
    answer = await fetch(`${API_BASE}/workspace/documents/${id}/file/${version ? `?version=${version}` : ""}`, {
      headers: serverHeaders({
        secret: process.env.INTERNAL_API_SECRET, access, json: false,
        forwardedFor: (await headers()).get("x-forwarded-for"),
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(30000),
    });
  } catch {
    return new Response("The document couldn't be reached just now.", { status: 503 });
  }
  if (answer.status !== 200) return new Response("Not found", { status: answer.status === 401 ? 401 : 404 });
  const out = new Headers({ "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" });
  for (const name of PASSED_ON) if (answer.headers.get(name)) out.set(name, answer.headers.get(name));
  return new Response(answer.body, { headers: out });
}
