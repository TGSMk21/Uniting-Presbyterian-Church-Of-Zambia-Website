// The dashboard's sidebar (AGENT_EXECUTION_PLAN.md, Task 7.3). It only offers what each
// person can use; the API still checks every request.
import { canManageStaff } from "./staffAdmin.mjs";

const CONTENT_ROLES = new Set(["branch_admin", "content_editor"]);

// Website content is for ministers, content editors and superusers, not elders.
export function handlesContent(staff) {
  return Boolean(staff?.is_superuser || staff?.role === "super_admin" || CONTENT_ROLES.has(staff?.role));
}

export function navGroups(staff) {
  const branch = staff.branch?.slug;
  const ownBranch = !staff.is_superuser && branch && CONTENT_ROLES.has(staff.role);
  const content = [];
  if (ownBranch) {
    const base = `/dashboard/content/${encodeURIComponent(branch)}`;
    content.push(
      { href: `${base}/messages`, label: "Daily messages", icon: "messages" },
      { href: `${base}/announcements`, label: "Announcements", icon: "announcements" },
      { href: `${base}/writings`, label: "Written sermons", icon: "writings" },
      { href: "/dashboard/content", label: "Branch content", icon: "content" },
      { href: `${base}/media`, label: "Media library", icon: "media" },
    );
  } else if (staff.is_superuser) {
    content.push({ href: "/dashboard/content", label: "Branch content", icon: "content" });
  }
  if (ownBranch || staff.is_superuser || staff.role === "super_admin") {
    content.push({ href: "/dashboard/pages", label: "Pages", icon: "pages" });
  }

  const people = canManageStaff(staff)
    ? [
        { href: "/dashboard/staff", label: "Staff", icon: "staff" },
        { href: "/dashboard/requests", label: "Requests", icon: "requests" },
      ]
    : [];
  const site = staff.is_superuser
    ? [
        { href: "/dashboard/branches", label: "Branches", icon: "branches" },
        { href: "/dashboard/history", label: "Change history", icon: "history" },
      ]
    : [];

  // The shared workspace (Phase 8), for ministers, elders and office bearers.
  const workspace = staff.workspace_member
    ? [
        { href: "/dashboard/meetings", label: "Meetings", icon: "meetings" },
        { href: "/dashboard/deliverables", label: "Deliverables", icon: "deliverables" },
        { href: "/dashboard/documents", label: "Documents", icon: "documents" },
        { href: "/dashboard/structure", label: "Church structure", icon: "structure" },
        ...(staff.is_superuser ? [{ href: "/dashboard/checklists", label: "Checklists", icon: "checklists" }] : []),
      ]
    : [];

  return [
    { label: "", items: [{ href: "/dashboard", label: "Overview", icon: "overview" }] },
    { label: "Workspace", items: workspace },
    { label: "Content", items: content },
    { label: "People", items: people },
    { label: "Site", items: site },
  ].filter((group) => group.items.length > 0);
}

// The link for the page being shown: the longest one the address starts with.
export function activeHref(pathname, hrefs) {
  let best = null;
  for (const href of hrefs) {
    const matches = pathname === href || pathname.startsWith(`${href}/`);
    if (matches && (best === null || href.length > best.length)) best = href;
  }
  return best;
}
