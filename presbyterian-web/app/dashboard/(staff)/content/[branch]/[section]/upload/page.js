import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import SermonUpload from "@/components/DashboardComponents/sermon-upload";
import { apiPath, isBranchSlug, ministerChoices, section } from "@/Utilities/branchContent.mjs";
import { sectionChoices } from "../../../../../content-choices";
import { requireStaff, staffRequest } from "../../../../../session";

// Adding a pastor's sermon files, one after another (AGENT_EXECUTION_PLAN.md, Task 4.1).
export default async function UploadFiles({ params }) {
  await requireStaff();
  const { branch, section: name } = await params;
  const spec = section(name);
  if (!spec?.uploads || !isBranchSlug(branch)) notFound();

  // Ask the API first, so nobody chooses files they can't add.
  const [{ status }, { ministers }] = await Promise.all([
    staffRequest(`${apiPath(branch, name)}?page=1`),
    sectionChoices(branch, name),
  ]);
  if (status === 401) redirect("/dashboard/login");
  if (status === 403 || status === 404) notFound();
  if (status !== 200) throw new Error(`The staff API answered ${status}`);

  const back = `/dashboard/content/${branch}/${name}`;
  return (
    <main className="dash-main">
      <Link href={back} className="dash-link" prefetch={false}>← All {spec.label.toLowerCase()}</Link>
      <h1 className="dash-heading dash-heading-spaced">Add sermon files</h1>
      {ministers && ministers.length === 0 ? (
        <p className="dash-text">
          Each sermon comes from one of your ministers, and this branch has none yet.{" "}
          <Link href={`/dashboard/content/${branch}/ministers/new`} prefetch={false}>Add a minister first</Link>.
        </p>
      ) : (
        <>
          <p className="dash-text">
            Choose one file or many at once, such as a minister&apos;s past sermons. Each file becomes a sermon titled
            after the file&apos;s name, which you can change afterwards. Only your branch&apos;s staff can see them.
          </p>
          <SermonUpload branch={branch} ministers={ministerChoices(ministers)} listHref={back} />
        </>
      )}
    </main>
  );
}
