import Link from "next/link";
import { notFound } from "next/navigation";
import PersonForm from "@/components/DashboardComponents/person-form";
import { canManageStaff } from "@/Utilities/staffAdmin.mjs";
import { requireStaff } from "../../../session";
import { allBranches, allMinisters } from "../../../staff-data";

export default async function AddPerson() {
  const staff = await requireStaff();
  if (!canManageStaff(staff)) notFound();
  const branches = staff.is_superuser ? (await allBranches()).filter((branch) => branch.is_active) : [];
  const ministers = staff.is_superuser ? await allMinisters(branches) : [];

  return (
    <main className="dash-main">
      <Link href="/dashboard/staff" className="dash-link" prefetch={false}>← Staff</Link>
      <h1 className="dash-heading dash-heading-spaced">Add someone</h1>
      <p className="dash-text">They get a link to choose their own password, for you to send them by WhatsApp or SMS.</p>
      <PersonForm
        id={null}
        values={{ role: "content_editor" }}
        superuser={staff.is_superuser}
        branches={branches}
        ministers={ministers}
        branchName={staff.branch?.name}
      />
    </main>
  );
}
