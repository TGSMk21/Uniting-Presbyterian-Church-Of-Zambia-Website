import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import PageEditor from "@/components/DashboardComponents/page-editor";
import { pageSchema, scopeKind, viewPath } from "@/Utilities/pageContent.mjs";
import { requireStaff, staffRequest } from "../../../../session";

export default async function EditPage({ params }) {
  await requireStaff();
  const { scope, page } = await params;
  const schema = pageSchema[scopeKind(scope)][page];
  if (!schema) notFound();

  // The API decides who can edit what; this page only asks it.
  const { status, data } = await staffRequest(`/page-content/${encodeURIComponent(scope)}/${encodeURIComponent(page)}/`);
  if (status === 401) redirect("/dashboard/login");
  if (status === 403 || status === 404) notFound();
  if (status !== 200) throw new Error(`The staff API answered ${status}`);

  return (
    <main className="dash-main">
      <Link href="/dashboard/pages" className="dash-link">← All pages</Link>
      <h1 className="dash-heading dash-heading-spaced">{schema.label}</h1>
      <p className="dash-text">
        Change any box and save. To go back to the original wording, clear the box and save.
        Photos save on their own as soon as you confirm them.
        {data.updated_by && ` Last edited by ${data.updated_by}.`}
      </p>
      <PageEditor
        scope={scope}
        page={page}
        sections={schema.sections}
        values={data.fields}
        viewHref={viewPath(scope, page)}
      />
    </main>
  );
}
