import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ApproveRequestForm, TurnDownForm } from "@/components/DashboardComponents/request-review";
import { requestSummary, suggestedUsername } from "@/Utilities/accessRequests.mjs";
import { isRowId } from "@/Utilities/branchContent.mjs";
import { canManageStaff } from "@/Utilities/staffAdmin.mjs";
import { requireStaff, staffRequest } from "../../../session";
import { allBranches, allMinisters } from "../../../staff-data";

export default async function Request({ params, searchParams }) {
  const staff = await requireStaff();
  if (!canManageStaff(staff)) notFound();
  const { id } = await params;
  if (!isRowId(id)) notFound();
  const turnedDown = (await searchParams).saved === "turned-down";

  const { status, data: request } = await staffRequest(`/staff-requests/${id}/`);
  if (status === 401) redirect("/dashboard/login");
  if (status === 403 || status === 404) notFound();
  if (status !== 200) throw new Error(`The staff API answered ${status}`);

  const waiting = request.status === "waiting";
  let branches = [];
  let ministers = [];
  if (waiting && staff.is_superuser) {
    branches = (await allBranches()).filter((branch) => branch.is_active);
    if (request.kind === "minister") {
      const own = branches.filter((branch) => branch.slug === request.branch);
      ministers = (await allMinisters(own)).filter((minister) => !minister.account_username);
    }
  }

  return (
    <main className="dash-main">
      <Link href="/dashboard/requests" className="dash-link" prefetch={false}>← Access requests</Link>
      <h1 className="dash-heading dash-heading-spaced">{request.full_name}</h1>
      <p className="dash-text">{requestSummary(request)}</p>
      {turnedDown && <p className="dash-notice" role="status">Turned down.</p>}
      <dl className="dash-details">
        <div><dt>Email</dt><dd>{request.email}</dd></div>
        <div><dt>Phone</dt><dd>{request.phone}</dd></div>
        <div><dt>Branch</dt><dd>{request.branch_name}</dd></div>
        <div><dt>Role asked for</dt><dd>{request.kind_label}</dd></div>
        {request.note && <div><dt>Their note</dt><dd className="dash-prewrap">{request.note}</dd></div>}
        {request.reason && <div><dt>Reason turned down</dt><dd className="dash-prewrap">{request.reason}</dd></div>}
      </dl>
      {waiting && request.existing_account && (
        <p className="dash-notice dash-notice-ai">
          Someone with this email already has an account: <strong>{request.existing_account}</strong>. Check this isn&apos;t
          the same person before approving.
        </p>
      )}
      {waiting && (
        <>
          <ApproveRequestForm
            id={request.id}
            kind={request.kind}
            fullName={request.full_name}
            superuser={staff.is_superuser}
            branch={request.branch}
            branchName={request.branch_name}
            branches={branches}
            ministers={ministers}
            username={suggestedUsername(request.full_name)}
          />
          <TurnDownForm id={request.id} />
        </>
      )}
    </main>
  );
}
