import RichText from "@/components/UniversalComponents/rich-text";
import ItemBoard from "@/components/ProjectsComponents/item-board";
import { getActivities, getPageContent, getProjects } from "@/Services/api";
import { pageFields } from "@/Utilities/pageContent.mjs";
import { projectItem, splitActivities } from "@/Utilities/projectItems.mjs";

export const revalidate = 3600;

// Projects and activities as cards that open into an overlay with photos and details
// (owner's request, 2026-11-08).
export default async function ProjectsAndActivities({ params }) {
  const { branch } = await params;
  const [projectsData, activitiesData, content] = await Promise.all([
    getProjects(branch),
    getActivities(branch),
    getPageContent(branch),
  ]);
  const f = pageFields("branch", "projects", content?.pages?.projects);
  const projects = (projectsData?.results || []).map(projectItem);
  const { upcoming, past } = splitActivities(activitiesData?.results || []);

  const sections = [
    { id: "upcoming", eyebrow: f.activities_label, title: f.activities_title, items: upcoming, empty: f.activities_empty },
    { id: "projects", eyebrow: f.projects_label, title: f.projects_title, items: projects, empty: f.projects_empty },
  ];
  if (past.length > 0) {
    sections.push({ id: "past", eyebrow: f.past_label, title: f.past_title, items: past.slice(0, 12), empty: "", muted: true });
  }

  return (
    <div>
      <section className="page-banner">
        <div className="page-banner-inner">
          <div className="page-banner-label">{f.banner_label}</div>
          <h1 style={{ fontFamily: "var(--font-playfair)" }}>
            <RichText text={f.banner_title} />
          </h1>
          <p className="page-banner-desc">{f.banner_text}</p>
        </div>
      </section>
      <div className="pa-page">
        <ItemBoard sections={sections} />
      </div>
    </div>
  );
}
