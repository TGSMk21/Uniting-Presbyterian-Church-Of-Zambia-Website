import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { FilePlus2, Search } from "lucide-react";
import { FILE_LABELS } from "@/Utilities/documents.mjs";
import { requireStaff, staffRequest } from "../../session";

const VIEWS = [
  { value: "shared", label: "Shared with you" },
  { value: "mine", label: "Yours" },
];

function when(value) {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "Africa/Lusaka" }).format(new Date(value));
}

// The document hub (Task 8.5): what's shared with you, and your own documents.
export default async function Documents({ searchParams }) {
  const staff = await requireStaff();
  if (!staff.workspace_member) notFound();
  const params = await searchParams;
  const view = VIEWS.some((v) => v.value === params.view) ? params.view : "shared";
  const q = String(params.q ?? "").trim().slice(0, 80);
  const query = new URLSearchParams({ view, ...(q && { q }) });
  const { status, data } = await staffRequest(`/workspace/documents/?${query}`);
  if (status === 401) redirect("/dashboard/login");
  if (status === 403) notFound();
  if (status !== 200) throw new Error("The workspace API didn't answer");
  const rows = data.results;

  return (
    <main className="dash-main">
      <header className="dash-page-head ws-page-head">
        <div>
          <h1 className="dash-heading">Documents</h1>
          <p className="dash-text">Minutes, reports and letters, shared only with the people who need them.</p>
        </div>
        <Link href="/dashboard/documents/new" className="btn-primary">
          <FilePlus2 size={18} aria-hidden="true" /> Add a document
        </Link>
      </header>
      {params.deleted === "1" && <p className="dash-notice" role="status">The document was deleted.</p>}

      <nav className="dash-tabs" aria-label="Show">
        {VIEWS.map((v) => (
          <Link key={v.value} href={`/dashboard/documents?view=${v.value}`} aria-current={v.value === view ? "page" : undefined}>
            {v.label}
          </Link>
        ))}
      </nav>
      <form className="ws-search" role="search" action="/dashboard/documents">
        <input type="hidden" name="view" value={view} />
        <label>
          <Search size={16} aria-hidden="true" />
          <span className="sr-only">Search documents</span>
          <input type="search" name="q" defaultValue={q} placeholder="Search by name" />
        </label>
      </form>

      {rows.length === 0 ? (
        <div className="dash-empty">
          <p>{q ? "No documents match that search." : view === "mine"
            ? "You haven't added any documents yet. Add one, read it through, then choose who can see it."
            : "Nothing has been shared with you yet. Documents shared with you, your branch or your meetings appear here."}</p>
        </div>
      ) : (
        <ul className="dash-rows">
          {rows.map((d) => (
            <li key={d.id}>
              <Link href={`/dashboard/documents/${d.id}`}>
                <span className="dash-row-title">
                  {d.title}
                  {!d.seen && <span className="dash-badge dash-badge-warning ws-new">New</span>}
                </span>
                <span className="dash-row-meta">
                  <span>{FILE_LABELS[d.file_type]}</span>
                  <span>{d.is_mine ? "Yours" : d.owner} · {when(d.updated_at)}{d.version > 1 ? ` · version ${d.version}` : ""}</span>
                  <span className="ws-muted">
                    {d.shared_with.length ? `Shared with ${d.shared_with.join(", ")}` : "Only you"}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
