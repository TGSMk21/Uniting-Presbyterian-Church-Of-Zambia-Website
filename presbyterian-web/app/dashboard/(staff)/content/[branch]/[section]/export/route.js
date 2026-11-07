import { exportResponse } from "../../../../../content-export";

export async function GET(request, { params }) {
  const { branch, section } = await params;
  return exportResponse(request, branch, section);
}
