import Link from "next/link";
import { getBranches } from "@/Services/api";
import { SECTIONS, manageableBranches } from "@/Utilities/branchContent.mjs";
import { requireStaff } from "../../session";

export default async function BranchContent() {
  const staff = await requireStaff();
  const branches = staff.is_superuser ? (await getBranches())?.results || [] : [];
  const manageable = manageableBranches(staff, branches);

  return (
    <main className="dash-main">
      <h1 className="dash-heading">Branch content</h1>
      <p className="dash-text">Add and change your branch&apos;s sermons, projects, activities, ministers, service times and daily messages, its private media library, and its contact details.</p>
      {manageable.length === 0 && (
        <p className="dash-text">
          {staff.is_superuser
            ? "The branches couldn't be loaded right now. Please try again in a moment."
            : "Your role doesn't include managing branch content."}
        </p>
      )}
      {manageable.map(({ slug, name }) => (
        <section key={slug} className="dash-panel">
          <h2 className="dash-subheading">{name}</h2>
          <ul className="dash-page-list">
            {Object.entries(SECTIONS).map(([section, { label }]) => (
              <li key={section}>
                <Link href={`/dashboard/content/${slug}/${section}`} prefetch={false}>{label}</Link>
              </li>
            ))}
            <li>
              <Link href={`/dashboard/content/${slug}/media`} prefetch={false}>Media library</Link>
            </li>
            <li>
              <Link href={`/dashboard/content/${slug}/details`} prefetch={false}>Contact details and map position</Link>
            </li>
          </ul>
        </section>
      ))}
    </main>
  );
}
