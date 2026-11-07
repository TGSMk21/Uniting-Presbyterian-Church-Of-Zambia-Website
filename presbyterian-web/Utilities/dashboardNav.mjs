// The dashboard's sidebar (AGENT_EXECUTION_PLAN.md, Task 7.3). It only offers what each
// person can use; the API still checks every request.
import { canManageStaff } from "./staffAdmin.mjs";

const CONTENT_ROLES = new Set(["branch_admin", "content_editor"]);

export function navGroups(staff) {
  const branch = staff.branch?.slug;
  const ownBranch = !staff.is_superuser && branch && CONTENT_ROLES.has(staff.role);
  const content = [];
  if (ownBranch) {
    const base = `/dashboard/content/${encodeURIComponent(branch)}`;
    content.push(
      { href: `${base}/messages`, label: "Daily messages", icon: "messages" },
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

  return [
    { label: "", items: [{ href: "/dashboard", label: "Overview", icon: "overview" }] },
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
