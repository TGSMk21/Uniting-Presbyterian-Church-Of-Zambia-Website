import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import MediaForm from "@/components/DashboardComponents/media-form";
import { isBranchSlug, isRowId } from "@/Utilities/branchContent.mjs";
import { mediaSummary, tagsText } from "@/Utilities/mediaLibrary.mjs";
import { requireStaff, staffRequest } from "../../../../../session";

export default async function MediaFile({ params }) {
  await requireStaff();
  const { branch, id } = await params;
  if (!isBranchSlug(branch) || !isRowId(id)) notFound();

  const { status, data: row } = await staffRequest(`/staff/${encodeURIComponent(branch)}/media/${id}/`);
  if (status === 401) redirect("/dashboard/login");
  if (status === 403 || status === 404) notFound();
  if (status !== 200) throw new Error(`The staff API answered ${status}`);

  return (
    <main className="dash-main">
      <Link href={`/dashboard/content/${branch}/media`} className="dash-link" prefetch={false}>← Media library</Link>
      <h1 className="dash-heading dash-heading-spaced">{row.title}</h1>
      <p className="dash-text">{mediaSummary(row)}</p>
      {row.file_type === "image" && (
        // Signed links expire, so the image optimiser can't cache these.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={row.url} alt={row.title} className="dash-media-preview" />
      )}
      <p className="dash-text">
        <a href={row.url} target="_blank" rel="noopener noreferrer">Open the file</a>. The link stops working after an
        hour; open this page again for a new one.
      </p>
      <MediaForm
        branch={branch}
        id={id}
        values={{ title: row.title, description: row.description || "", tags: tagsText(row.tags) }}
      />
    </main>
  );
}
