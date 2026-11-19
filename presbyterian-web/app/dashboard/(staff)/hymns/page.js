import { notFound, redirect } from "next/navigation";
import { requireStaff, staffRequest } from "../../session";
import HymnsAdmin from "./hymns-admin";

export const metadata = { title: "Hymns · Dashboard" };

// The hymn collections are church-wide and superuser-only (MOBILE_APP_PLAN.md, Phase 6).
export default async function HymnsPage() {
  const staff = await requireStaff();
  if (!staff.is_superuser) notFound();
  const { status, data } = await staffRequest("/staff-hymns/");
  if (status === 401) redirect("/dashboard/login");
  if (status !== 200) throw new Error(`The staff API answered ${status}`);
  return (
    <main className="dash-main">
      <h1 className="dash-heading">Hymns</h1>
      <p className="dash-text">
        The three hymn collections the app shows. Add or import hymns here; every change is recorded in the
        change history under “Hymns”. The app downloads a collection the first time someone opens it, so members
        can read offline.
      </p>
      <HymnsAdmin initialHymns={data.results ?? data ?? []} />
    </main>
  );
}
