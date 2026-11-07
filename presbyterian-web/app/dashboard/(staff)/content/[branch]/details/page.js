import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import BranchDetailsForm from "@/components/DashboardComponents/branch-details-form";
import { isBranchSlug } from "@/Utilities/branchContent.mjs";
import { formatPosition } from "@/Utilities/branchDetails.mjs";
import { requireStaff, staffRequest } from "../../../../session";

export default async function BranchDetails({ params }) {
  await requireStaff();
  const { branch } = await params;
  if (!isBranchSlug(branch)) notFound();

  // The API decides who can manage which branch; this page only asks it.
  const { status, data } = await staffRequest(`/staff/${encodeURIComponent(branch)}/details/`);
  if (status === 401) redirect("/dashboard/login");
  if (status === 403 || status === 404) notFound();
  if (status !== 200) throw new Error(`The staff API answered ${status}`);

  return (
    <main className="dash-main">
      <Link href="/dashboard/content" className="dash-link" prefetch={false}>← Branch content</Link>
      <h1 className="dash-heading dash-heading-spaced">Contact details and map position</h1>
      <p className="dash-text">
        <strong>{data.name}.</strong> These show on your About page, at the foot of every page, and in Find a Branch.
      </p>
      <BranchDetailsForm
        branch={branch}
        values={{
          contact_email: data.contact_email || "",
          contact_phone: data.contact_phone || "",
          address: data.address || "",
          location_confirmed: Boolean(data.location_confirmed),
        }}
        positionText={formatPosition(data.latitude, data.longitude)}
        viewHref="/find-a-branch"
      />
    </main>
  );
}
