import { exportResponse } from "../../../../../content-export";

export async function GET(request, { params }) {
  const { branch } = await params;
  return exportResponse(request, branch, "media");
}
