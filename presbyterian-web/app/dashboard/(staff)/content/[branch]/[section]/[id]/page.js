import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import ContentForm from "@/components/DashboardComponents/content-form";
import MessageReview from "@/components/DashboardComponents/message-review";
import MinisterPhoto from "@/components/DashboardComponents/minister-photo";
import {
  apiPath,
  formValues,
  isBranchSlug,
  isRowId,
  ministerChoices,
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
        <p className="dash-text">
          {data.account_username
            ? <>Signs in to the dashboard as <strong>{data.account_username}</strong>.</>
            : "Has no dashboard account yet. The developer links one from the Staff page."}
        </p>
      )}
      {name === "ministers" && (
        <MinisterPhoto branch={branch} id={id} value={data.photo || ""} viewHref={spec.publicPath(branch)} />
      )}
      {name === "messages" && <MessageReview branch={branch} id={id} message={data} />}
      {name === "messages" && <h2 className="dash-subheading dash-edit-heading">Edit the message</h2>}
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
