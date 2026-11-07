import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import ContentForm from "@/components/DashboardComponents/content-form";
import { apiPath, isBranchSlug, ministerChoices, newRowDefaults, section } from "@/Utilities/branchContent.mjs";
import { sectionChoices } from "../../../../../content-choices";
import { requireStaff, staffRequest } from "../../../../../session";

export default async function AddRow({ params }) {
  await requireStaff();
  const { branch, section: name } = await params;
  const spec = section(name);
  if (!spec || !isBranchSlug(branch)) notFound();

  // Ask the API first, so nobody fills in a form they can't save.
  const [{ status }, { ministers }] = await Promise.all([
    staffRequest(`${apiPath(branch, name)}?page=1`),
    sectionChoices(branch, name),
  ]);
  if (status === 401) redirect("/dashboard/login");
  if (status === 403 || status === 404) notFound();
  if (status !== 200) throw new Error(`The staff API answered ${status}`);

  const back = (
    <Link href={`/dashboard/content/${branch}/${name}`} className="dash-link" prefetch={false}>
      ← All {spec.label.toLowerCase()}
    </Link>
  );

  // A daily message comes from one of the branch's ministers.
  if (ministers && ministers.length === 0) {
    return (
      <main className="dash-main">
        {back}
        <h1 className="dash-heading dash-heading-spaced">{spec.adding}</h1>
        <p className="dash-text">
          Each message comes from one of your ministers, and this branch has none yet.{" "}
          <Link href={`/dashboard/content/${branch}/ministers/new`} prefetch={false}>Add a minister first</Link>.
        </p>
      </main>
    );
  }

  return (
    <main className="dash-main">
      {back}
      <h1 className="dash-heading dash-heading-spaced">{spec.adding}</h1>
      <ContentForm
        branch={branch}
        name={name}
        id={null}
        values={newRowDefaults(name, { ministers })}
        choices={{ ministers: ministerChoices(ministers) }}
      />
    </main>
  );
}
