import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import ContentForm from "@/components/DashboardComponents/content-form";
import MinisterPhoto from "@/components/DashboardComponents/minister-photo";
import {
  apiPath,
  formValues,
  isBranchSlug,
  isRowId,
  ministerChoices,
  publishedNote,
  rowTitle,
  section,
} from "@/Utilities/branchContent.mjs";
import { sectionChoices } from "../../../../../content-choices";
import { requireStaff, staffRequest } from "../../../../../session";

export default async function EditRow({ params }) {
  await requireStaff();
  const { branch, section: name, id } = await params;
  const spec = section(name);
  if (!spec || !isBranchSlug(branch) || !isRowId(id)) notFound();

  const [{ status, data }, { ministers }] = await Promise.all([
    staffRequest(apiPath(branch, name, id)),
    sectionChoices(branch, name),
  ]);
  if (status === 401) redirect("/dashboard/login");
  if (status === 403 || status === 404) notFound();
  if (status !== 200) throw new Error(`The staff API answered ${status}`);

  return (
    <main className="dash-main">
      <Link href={`/dashboard/content/${branch}/${name}`} className="dash-link" prefetch={false}>
        ← All {spec.label.toLowerCase()}
      </Link>
      <h1 className="dash-heading dash-heading-spaced">{rowTitle(data)}</h1>
      {name === "sermons" && data.video_id && (
        <p className="dash-text">
          {data.is_live ? "Live on YouTube now. " : ""}
          <a href={`https://www.youtube.com/watch?v=${encodeURIComponent(data.video_id)}`} target="_blank" rel="noopener">
            Watch on YouTube
          </a>
          . The video itself can&apos;t be changed here.
        </p>
      )}
      {name === "ministers" && (
        <MinisterPhoto branch={branch} id={id} value={data.photo || ""} viewHref={spec.publicPath(branch)} />
      )}
      {name === "messages" && data.status === "published" && data.published_at && (
        <p className="dash-text">{publishedNote(data)}</p>
      )}
      <ContentForm
        branch={branch}
        name={name}
        id={id}
        values={formValues(name, data)}
        choices={{ ministers: ministerChoices(ministers) }}
      />
    </main>
  );
}
