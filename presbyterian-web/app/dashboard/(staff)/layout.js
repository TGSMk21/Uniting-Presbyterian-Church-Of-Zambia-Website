import DashboardShell from "@/components/DashboardComponents/dashboard-shell";
import { navGroups } from "@/Utilities/dashboardNav.mjs";
import { signOut } from "../actions";
import { requireStaff } from "../session";

export default async function StaffLayout({ children }) {
  const staff = await requireStaff();
  const person = {
    name: staff.name,
    role: staff.is_superuser ? "Developer (superuser)" : staff.role_label,
    place: staff.is_superuser ? "All branches" : staff.branch?.name || "National office",
  };

  return (
    <DashboardShell groups={navGroups(staff)} person={person} signOut={signOut}>
      {children}
    </DashboardShell>
  );
}
