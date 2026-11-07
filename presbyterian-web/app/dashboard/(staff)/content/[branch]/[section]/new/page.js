import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import ContentForm from "@/components/DashboardComponents/content-form";
import { NEW_DEFAULTS, apiPath, isBranchSlug, section } from "@/Utilities/branchContent.mjs";
import { requireStaff, staffRequest } from "../../../../../session";

export default async function AddRow({ params }) {
  await requireStaff();
  const { branch, section: name } = await params;
  const spec = section(name);
  if (!spec || !isBranchSlug(branch)) notFound();

  // Ask the API first, so nobody fills in a form they can't save.
  const { status } = await staffRequest(`${apiPath(branch, name)}?page=1`);
  if (status === 401) redirect("/dashboard/login");
  if (status === 403 || status === 404) notFound();
  if (status !== 200) throw new Error(`The staff API answered ${status}`);

  return (
    <main className="dash-main">
      <Link href={`/dashboard/content/${branch}/${name}`} className="dash-link" prefetch={false}>
        ← All {spec.label.toLowerCase()}
      </Link>
      <h1 className="dash-heading dash-heading-spaced">{spec.adding}</h1>
      <ContentForm branch={branch} name={name} id={null} values={NEW_DEFAULTS[name]} />
    </main>
  );
}
