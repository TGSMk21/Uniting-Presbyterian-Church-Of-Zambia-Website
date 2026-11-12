import { notFound, redirect } from "next/navigation";
import OfficeList from "@/components/WorkspaceComponents/office-list";
import AddPresbytery from "@/components/WorkspaceComponents/add-presbytery";
import { SYNOD_NAME, placeTitle } from "@/Utilities/workspace.mjs";
import { requireStaff, staffRequest } from "../../session";

// The church's structure (AGENT_EXECUTION_PLAN.md, Task 8.1): who holds which office at
// your branch, your presbytery and the synod. Ministers appoint their branch's office
// bearers; the superuser appoints presbytery and synod office bearers.
export default async function Structure() {
  const staff = await requireStaff();
  if (!staff.workspace_member) notFound();
  const [structure, me] = await Promise.all([staffRequest("/workspace/structure/"), staffRequest("/workspace/me/")]);
  if (structure.status === 401 || me.status === 401) redirect("/dashboard/login");
  if (structure.status === 403) notFound();
  if (structure.status !== 200 || me.status !== 200) throw new Error("The workspace API didn't answer");

  const { presbyteries, synod, positions, unplaced_branches: unplaced } = structure.data;
  const superuser = me.data.is_superuser;
  const myBranch = me.data.branch;
  let branchOffice = null;
  if (myBranch) {
    const { status, data } = await staffRequest(`/workspace/branches/${encodeURIComponent(myBranch.slug)}/`);
    if (status === 200) branchOffice = data;
  }
  const myPresbytery = presbyteries.find((p) => p.slug === me.data.presbytery?.slug);
  const shownPresbyteries = superuser ? presbyteries : myPresbytery ? [myPresbytery] : [];

  return (
    <main className="dash-main">
      <h1 className="dash-heading">Church structure</h1>
      <p className="dash-text">Who holds which office at your branch, your presbytery and the synod.</p>

      {branchOffice && (
        <section className="dash-card ws-level" aria-labelledby="ws-branch">
          <p className="ws-level-label">Your branch</p>
          <h2 id="ws-branch" className="dash-subheading">{branchOffice.branch.name}</h2>
          <OfficeList positions={positions} level="branch" officeBearers={branchOffice.office_bearers}
            place={branchOffice.branch} scope={{ branch: branchOffice.branch.slug }} canAppoint={branchOffice.can_appoint} />
          {branchOffice.can_appoint && (
            <p className="dash-help">Office bearers must have an account at your branch. Add elders from Staff.</p>
          )}
        </section>
      )}

      {shownPresbyteries.map((presbytery) => (
        <section key={presbytery.slug} className="dash-card ws-level" aria-labelledby={`ws-p-${presbytery.slug}`}>
          <p className="ws-level-label">{presbytery.slug === myPresbytery?.slug ? "Your presbytery" : "Presbytery"}</p>
          <h2 id={`ws-p-${presbytery.slug}`} className="dash-subheading">{placeTitle("presbytery", presbytery)}</h2>
          <OfficeList positions={positions} level="presbytery" officeBearers={presbytery.office_bearers}
            place={presbytery} scope={{ presbytery: presbytery.slug }} canAppoint={superuser} />
          <p className="ws-branches">
            <span className="ws-branches-label">Branches:</span>{" "}
            {presbytery.branches.length ? presbytery.branches.map((b) => b.name).join(", ") : "None placed here yet."}
          </p>
        </section>
      ))}

      <section className="dash-card ws-level" aria-labelledby="ws-synod">
        <p className="ws-level-label">The whole church</p>
        <h2 id="ws-synod" className="dash-subheading">{SYNOD_NAME}</h2>
        <OfficeList positions={positions} level="synod" officeBearers={synod.office_bearers} canAppoint={superuser} />
      </section>

      {superuser && (
        <section className="dash-card ws-level" aria-labelledby="ws-admin">
          <h2 id="ws-admin" className="dash-subheading">Presbyteries</h2>
          {unplaced.length > 0 && (
            <p className="dash-notice dash-notice-warning">
              Not in a presbytery yet: {unplaced.map((b) => b.name).join(", ")}. Choose theirs on each branch&apos;s page under Branches.
            </p>
          )}
          <AddPresbytery />
        </section>
      )}
    </main>
  );
}
