import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import BranchAdminForm from "@/components/DashboardComponents/branch-admin-form";
import { isBranchSlug } from "@/Utilities/branchContent.mjs";
import { requireStaff, staffRequest } from "../../../session";

const SAVED = { added: "Branch added. Next, add its first branch admin from Staff.", changed: "Saved." };

export default async function Branch({ params, searchParams }) {
  const staff = await requireStaff();
  if (!staff.is_superuser) notFound();
  const { slug } = await params;
  if (!isBranchSlug(slug)) notFound();
  const query = await searchParams;
  const saved = Object.hasOwn(SAVED, query.saved ?? "") ? SAVED[query.saved] : null;

  const { status, data: branch } = await staffRequest(`/staff-branches/${encodeURIComponent(slug)}/`);
  if (status === 401) redirect("/dashboard/login");
  if (status === 403 || status === 404) notFound();
  if (status !== 200) throw new Error(`The staff API answered ${status}`);

  return (
    <main className="dash-main">
      <Link href="/dashboard/branches" className="dash-link" prefetch={false}>← Branches</Link>
      <h1 className="dash-heading dash-heading-spaced">{branch.name}</h1>
      {saved && <p className="dash-notice" role="status">{saved}</p>}
      <p className="dash-text">
        At <a href={`/${branch.slug}`} target="_blank" rel="noopener">/{branch.slug}</a>.{" "}
        <Link href={`/dashboard/staff?branch=${branch.slug}`} prefetch={false}>Its staff</Link>
        {" · "}
        <Link href={`/dashboard/content`} prefetch={false}>Its content</Link>
      </p>
      <BranchAdminForm
        slug={branch.slug}
        values={{
          name: branch.name,
          contact_email: branch.contact_email,
          youtube_channel_id: branch.youtube_channel_id,
          is_active: branch.is_active,
        }}
      />
    </main>
  );
}
