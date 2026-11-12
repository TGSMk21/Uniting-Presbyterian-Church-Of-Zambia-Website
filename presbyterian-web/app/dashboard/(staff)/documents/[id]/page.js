import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import DocumentViewer from "@/components/WorkspaceComponents/document-viewer";
import { DocumentSettings, NewVersion, SharePanel, Versions, Viewers } from "@/components/WorkspaceComponents/document-owner";
import { FILE_LABELS, viewerKind } from "@/Utilities/documents.mjs";
import { isRowId } from "@/Utilities/workspace.mjs";
import { requireStaff, staffRequest } from "../../../session";

const NOTICES = {
  added: "Saved. Only you can see it: read it through, then choose who to share it with.",
  saved: "New version saved.",
  share_failed: "Saved, but it couldn't be shared with the meeting just now. Only you can see it: share it below.",
};

export default async function DocumentPage({ params, searchParams }) {
  const staff = await requireStaff();
  const { id } = await params;
  if (!staff.workspace_member || !isRowId(id)) notFound();
  const { status, data: document } = await staffRequest(`/workspace/documents/${id}/`);
  if (status === 401) redirect("/dashboard/login");
  if (status === 403 || status === 404) notFound();
  if (status !== 200) throw new Error("The workspace API didn't answer");

  const query = await searchParams;
  const asked = isRowId(query.version) ? Number(query.version) : null;
  const version = document.versions.find((v) => v.number === asked) ?? document.versions[0];
  const newest = document.versions[0]?.number;
  const suffix = version.number === newest ? "" : `?version=${version.number}`;
  let preview = null;
  if (["word", "written", "text"].includes(viewerKind(version.file_type))) {
    const answer = await staffRequest(`/workspace/documents/${id}/preview/${suffix}`);
    if (answer.status === 200) preview = answer.data;
  }
  const notice = Object.keys(NOTICES).find((key) => query[key] === "1");
  const owner = document.is_mine;

  return (
    <main className="dash-main">
      <Link href={`/dashboard/documents?view=${owner ? "mine" : "shared"}`} className="dash-link">Documents</Link>
      {notice && <p className="dash-notice" role="status">{NOTICES[notice]}</p>}
      <header className="ws-meeting-head">
        <p className="ws-level-label">{FILE_LABELS[version.file_type]}</p>
        <h1 className="dash-heading">{document.title}</h1>
        {document.description && <p className="dash-text">{document.description}</p>}
        <p className="dash-help">
          {owner ? "Yours" : `From ${document.owner}`}
          {document.versions.length > 1 ? ` · version ${version.number} of ${newest}` : ""}
          {!owner && document.shared_with.length > 0 && ` · shared with ${document.shared_with.join(", ")}`}
        </p>
        {version.number !== newest && (
          <p className="dash-notice dash-notice-warning">
            This is an older version. <Link href={`/dashboard/documents/${id}`} className="dash-link">See the newest</Link>
          </p>
        )}
      </header>

      <div className="ws-doc-layout">
        <div className="ws-doc-main">
          <DocumentViewer document={document} version={version} preview={preview}
            file={`/dashboard/documents/${id}/file${suffix}`} />
        </div>
        <aside className="ws-doc-side">
          {owner && <SharePanel document={document} startOpen={notice === "added" || notice === "share_failed"} />}
          {owner && <div className="ws-actions ws-doc-tools"><NewVersion document={document} /></div>}
          {document.versions.length > 1 && <Versions document={document} showing={version.number} owner={owner} />}
          {owner && <Viewers viewers={document.viewers} newest={newest} />}
          {owner && <DocumentSettings document={document} />}
        </aside>
      </div>
    </main>
  );
}
