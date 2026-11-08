import Link from "next/link";
import {
  BookOpen, CalendarDays, Church, Clock, FolderKanban, Image as ImageIcon, MapPin, Megaphone, MessageSquareText, PlaySquare,
} from "lucide-react";
import { getBranches } from "@/Services/api";
import { SECTIONS, manageableBranches } from "@/Utilities/branchContent.mjs";
import { requireStaff } from "../../session";

const ICONS = {
  sermons: PlaySquare, projects: FolderKanban, activities: CalendarDays, announcements: Megaphone, ministers: Church, services: Clock,
  messages: MessageSquareText, writings: BookOpen, media: ImageIcon, details: MapPin,
};
// The sections grouped by what they're for (Task 7.3).
const GROUPS = [
  { label: "On your website", items: ["announcements", "sermons", "projects", "activities", "ministers", "services", "details"] },
  { label: "Daily messages", items: ["messages", "writings"] },
  { label: "Private to your branch", items: ["media"] },
];
const EXTRA = {
  media: { label: "Media library", summary: "Photos, documents and recordings for staff" },
  details: { label: "Contact details and map", summary: "Phone, email, address and Find a Branch pin" },
};

function card(slug, key) {
  const spec = SECTIONS[key] || EXTRA[key];
  const Icon = ICONS[key];
  return (
    <li key={key}>
      <Link href={`/dashboard/content/${slug}/${key}`} prefetch={false} className="dash-card-link">
        <Icon size={20} strokeWidth={1.75} aria-hidden="true" />
        <span>
          <strong>{spec.label}</strong>
          <small>{spec.summary}</small>
        </span>
      </Link>
    </li>
  );
}

export default async function BranchContent() {
  const staff = await requireStaff();
  const branches = staff.is_superuser ? (await getBranches())?.results || [] : [];
  const manageable = manageableBranches(staff, branches);

  return (
    <main className="dash-main">
      <header className="dash-page-head">
        <h1 className="dash-heading">Branch content</h1>
        <p className="dash-text">Everything your branch keeps here, grouped by what it&apos;s for.</p>
      </header>
      {manageable.length === 0 && (
        <p className="dash-text">
          {staff.is_superuser
            ? "The branches couldn't be loaded right now. Please try again in a moment."
            : "Your role doesn't include managing branch content."}
        </p>
      )}
      {manageable.map(({ slug, name }) => (
        <section key={slug} className="dash-branch-block" aria-label={name}>
          {manageable.length > 1 && <h2 className="dash-subheading dash-branch-name">{name}</h2>}
          {GROUPS.map((group) => (
            <div key={group.label} className="dash-card-group">
              <p className="dash-sidenav-label">{group.label}</p>
              <ul className="dash-card-grid">{group.items.map((key) => card(slug, key))}</ul>
            </div>
          ))}
        </section>
      ))}
    </main>
  );
}
