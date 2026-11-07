import Link from "next/link";
import { getBranches } from "@/Services/api";
import { editableScopes, pageSchema, scopeKind } from "@/Utilities/pageContent.mjs";
import { requireStaff } from "../../session";

export default async function PagesList() {
  const staff = await requireStaff();
  const branches = staff.is_superuser ? (await getBranches())?.results || [] : [];
  const scopes = editableScopes(staff, branches);

  return (
    <main className="dash-main">
      <h1 className="dash-heading">Pages</h1>
      <p className="dash-text">Choose a page to change its wording.</p>
      {scopes.length === 0 && (
        <p className="dash-text">Your role doesn&apos;t include editing pages.</p>
      )}
      {scopes.map(({ scope, name }) => (
        <section key={scope} className="dash-panel">
          <h2 className="dash-subheading">{name}</h2>
          <ul className="dash-page-list">
            {Object.entries(pageSchema[scopeKind(scope)]).map(([page, { label }]) => (
              <li key={page}>
                <Link href={`/dashboard/pages/${scope}/${page}`} prefetch={false}>{label}</Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}
