import DashboardShell from "@/components/DashboardComponents/dashboard-shell";
import { navGroups } from "@/Utilities/dashboardNav.mjs";
import { signOut } from "../actions";
import { requireStaff, staffRequest } from "../session";

export default async function StaffLayout({ children }) {
  const staff = await requireStaff();
  // The bell's unread count, for workspace members (Task 8.2). A failure just hides the count.
  let notifications = null;
  if (staff.workspace_member) {
    const { status, data } = await staffRequest("/workspace/notifications/");
    notifications = { unread: status === 200 ? data.unread : 0 };
  }
  const person = {
    name: staff.name,
    role: staff.is_superuser ? "Developer (superuser)" : staff.role_label,
    place: staff.is_superuser ? "All branches" : staff.branch?.name || "National office",
  };

  return (
    <DashboardShell groups={navGroups(staff)} person={person} signOut={signOut} notifications={notifications}>
      {children}
    </DashboardShell>
  );
}
