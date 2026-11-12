import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { attentionItems, greeting } from "@/Utilities/overview.mjs";
import { workspaceAttention } from "@/Utilities/deliverables.mjs";
import { handlesContent } from "@/Utilities/dashboardNav.mjs";
import { changeSummary } from "@/Utilities/staffAdmin.mjs";
import { requireStaff, staffRequest } from "../session";

const TIME_ZONE = "Africa/Lusaka";

function when(value) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: TIME_ZONE, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).format(new Date(value));
}

// A short list of what needs doing now, each linking to where it's done (Task 7.3).
export default async function DashboardHome() {
  const staff = await requireStaff();
  const content = handlesContent(staff);
  const [{ status, data }, workspace] = await Promise.all([
    content ? staffRequest("/staff-overview/") : Promise.resolve({ status: 204, data: null }),
    staff.workspace_member ? staffRequest("/workspace/attention/") : Promise.resolve({ status: 204, data: null }),
  ]);
  if (status === 401 || workspace.status === 401) redirect("/dashboard/login");
  const overview = status === 200 ? data : null;
  // Workspace reminders first: they're about people waiting on each other.
  const items = [...workspaceAttention(workspace.status === 200 ? workspace.data : null),
    ...(overview ? attentionItems(overview) : [])];
  const failed = (content && status !== 200) || (staff.workspace_member && workspace.status !== 200);
  const today = new Intl.DateTimeFormat("en-GB", { timeZone: TIME_ZONE, weekday: "long", day: "numeric", month: "long" }).format(new Date());
  const own = !staff.is_superuser && overview?.branches?.length === 1 ? overview.branches[0] : null;
  const base = own ? `/dashboard/content/${encodeURIComponent(own.slug)}` : null;

  return (
    <main className="dash-main">
      <header className="dash-page-head">
        <h1 className="dash-heading">{greeting(staff.name)}</h1>
        <p className="dash-text">{today}{own ? ` · ${own.name}` : staff.is_superuser ? " · All branches" : ""}</p>
      </header>

      <section className="dash-panel" aria-labelledby="attention">
        <h2 id="attention" className="dash-subheading">Needs your attention</h2>
        {failed && items.length === 0 ? (
          <p className="dash-text">This couldn&apos;t be loaded right now. Please try again in a moment.</p>
        ) : items.length === 0 ? (
          <p className="dash-text">You&apos;re up to date. Nothing needs your attention.</p>
        ) : (
          <ul className="dash-attention">
            {items.map((item) => (
              <li key={item.text}>
                <Link href={item.href} prefetch={false} data-tone={item.tone}>
                  <span className="dash-attention-dot" aria-hidden="true" />
                  <span className="dash-attention-text">{item.text}</span>
                  <ChevronRight size={16} aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {base && (
        <section className="dash-panel" aria-labelledby="shortcuts">
          <h2 id="shortcuts" className="dash-subheading">Shortcuts</h2>
          <div className="dash-shortcuts">
            <Link href={`${base}/messages/new`} className="btn-ghost" prefetch={false}>Write a daily message</Link>
            <Link href={`${base}/writings/upload`} className="btn-ghost" prefetch={false}>Add sermon files</Link>
            <Link href={`${base}/activities/new`} className="btn-ghost" prefetch={false}>Add an event</Link>
            <Link href="/dashboard/pages" className="btn-ghost" prefetch={false}>Edit your pages</Link>
          </div>
        </section>
      )}

      {overview?.recent_changes?.length > 0 && (
        <section className="dash-panel" aria-labelledby="recent">
          <div className="dash-panel-head">
            <h2 id="recent" className="dash-subheading">Recent changes</h2>
            <Link href="/dashboard/history" className="dash-link" prefetch={false}>See all</Link>
          </div>
          <ul className="dash-history dash-history-flat">
            {overview.recent_changes.map((change) => (
              <li key={`${change.at}-${change.target}-${change.action}`}>
                <span className="dash-history-what">{changeSummary(change)}</span>
                <span className="dash-row-meta">{[change.branch, when(change.at)].filter(Boolean).join(" · ")}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="dash-panel" aria-labelledby="account">
        <h2 id="account" className="dash-subheading">Your account</h2>
        <dl className="dash-details">
          <div><dt>Username</dt><dd>{staff.username}</dd></div>
          <div><dt>Role</dt><dd>{staff.is_superuser ? "Developer (superuser)" : staff.role_label}</dd></div>
          <div><dt>Branch</dt><dd>{staff.branch?.name || "All branches"}</dd></div>
          <div><dt>Two-step login</dt><dd>{staff.two_factor_enabled ? "On" : "Off"}</dd></div>
        </dl>
        <div className="dash-links">
          <Link href="/dashboard/change-password" className="dash-link" prefetch={false}>Change your password</Link>
          {!staff.two_factor_enabled && (
            <Link href="/dashboard/two-factor" className="dash-link" prefetch={false}>Turn on two-step login</Link>
          )}
        </div>
      </section>
    </main>
  );
}
