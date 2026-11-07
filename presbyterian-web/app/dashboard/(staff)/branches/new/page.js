import Link from "next/link";
import { notFound } from "next/navigation";
import BranchAdminForm from "@/components/DashboardComponents/branch-admin-form";
import { requireStaff } from "../../../session";

export default async function AddBranch() {
  const staff = await requireStaff();
  if (!staff.is_superuser) notFound();

  return (
    <main className="dash-main">
      <Link href="/dashboard/branches" className="dash-link" prefetch={false}>← Branches</Link>
      <h1 className="dash-heading dash-heading-spaced">Add a branch</h1>
      <p className="dash-text">
        It appears on the website and in Find a Branch straight away. Then add its first branch admin from Staff, and
        they fill in the rest.
      </p>
      <BranchAdminForm slug={null} values={{}} />
    </main>
  );
}
