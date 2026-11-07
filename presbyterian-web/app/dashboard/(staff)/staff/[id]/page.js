import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import PersonActions from "@/components/DashboardComponents/person-actions";
import PersonForm from "@/components/DashboardComponents/person-form";
import { isRowId } from "@/Utilities/branchContent.mjs";
import { canManageStaff, personSummary } from "@/Utilities/staffAdmin.mjs";
import { requireStaff, staffRequest } from "../../../session";
import { allBranches } from "../../../staff-data";

function when(value) {
  if (!value) return "Never";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Lusaka", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).format(new Date(value));
}

export default async function Person({ params, searchParams }) {
  const staff = await requireStaff();
  if (!canManageStaff(staff)) notFound();
  const { id } = await params;
  if (!isRowId(id)) notFound();
  const saved = (await searchParams).saved === "changed";

  const [{ status, data: person }, branches] = await Promise.all([
    staffRequest(`/staff-people/${id}/`),
    staff.is_superuser ? allBranches() : Promise.resolve([]),
  ]);
  if (status === 401) redirect("/dashboard/login");
  if (status === 403 || status === 404) notFound();
  if (status !== 200) throw new Error(`The staff API answered ${status}`);

  const name = [person.first_name, person.last_name].filter(Boolean).join(" ") || person.username;
  return (
    <main className="dash-main">
      <Link href="/dashboard/staff" className="dash-link" prefetch={false}>← Staff</Link>
      <h1 className="dash-heading dash-heading-spaced">{name}</h1>
      <p className="dash-text">{personSummary(person)}</p>
      {saved && <p className="dash-notice" role="status">Saved.</p>}
      <dl className="dash-details">
        <div><dt>Username</dt><dd>{person.username}</dd></div>
        <div><dt>Last signed in</dt><dd>{when(person.last_login)}</dd></div>
        <div><dt>Account made</dt><dd>{when(person.date_joined)}</dd></div>
      </dl>
      {person.can_manage ? (
        <>
          <PersonForm
            id={id}
            values={{
              first_name: person.first_name, last_name: person.last_name, email: person.email,
              role: person.role, branch: person.branch || "",
            }}
            superuser={staff.is_superuser}
            branches={branches.filter((branch) => branch.is_active || branch.slug === person.branch)}
          />
          <PersonActions
            id={id}
            username={person.username}
            isActive={person.is_active}
            superuser={staff.is_superuser}
            twoFactor={person.two_factor_enabled}
          />
        </>
      ) : (
        <p className="dash-text">
          {person.username === staff.username
            ? "This is your own account. Change your password from the Overview page."
            : "This account is managed in the Django admin."}
        </p>
      )}
    </main>
  );
}
