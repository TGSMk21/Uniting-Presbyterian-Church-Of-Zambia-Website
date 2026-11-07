import { ScrollReveal } from "@/components/UniversalComponents/scroll-reveal";
import RichText from "@/components/UniversalComponents/rich-text";
import { getProjects, getActivities, getPageContent } from "@/Services/api";
import { pageFields } from "@/Utilities/pageContent.mjs";

export const revalidate = 3600;

function formatTime12(t) {
  if (!t) return '';
  const [h, m] = t.split(':');
  const hour = parseInt(h, 10);
  if (isNaN(hour)) return t.slice(0, 5);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}:${m} ${ampm}`;
}

export default async function ProjectsAndActivities({ params }) {
  const { branch } = await params;
  const [projectsData, activitiesData, content] = await Promise.all([
    getProjects(branch),
    getActivities(branch),
    getPageContent(branch),
  ]);
  const f = pageFields("branch", "projects", content?.pages?.projects);
  const projects = projectsData?.results || [];
  const activities = activitiesData?.results || [];
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

      <section className="projects-content">
        <div className="projects-inner">
          <ScrollReveal>
            <div className="section-header">
              <div>
                <div className="section-label">{f.projects_label}</div>
                <h2
                  className="section-title"
                  style={{ fontFamily: "var(--font-playfair)" }}
                >
                  <RichText text={f.projects_title} />
                </h2>
              </div>
            </div>
          </ScrollReveal>

          <div className="projects-grid">
            {projects.map((item, i) => (
              <ScrollReveal key={item.id} delay={i + 1}>
                <div className="project-card">
                  <div className="project-header">
                    <span className={`project-status ${item.status.toLowerCase()}`}>{item.status.toLowerCase()}</span>
                    <h3 className="project-title">{item.title}</h3>
                  </div>
                  <div className="project-body">
                    <p className="project-desc">{item.description}</p>
                    <div className="project-timeline">
                      <div className="project-timeline-label">Timeline</div>
                      <div className="project-timeline-date">
                        {item.start_date ? new Date(item.start_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : ''}
                        {item.end_date ? ` — ${new Date(item.end_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}` : ''}
                      </div>
                    </div>
                    <div>
                      <div className="project-progress-label">
                        <span>Progress</span>
                        <strong>{item.progress}%</strong>
                      </div>
                      <div className="project-progress-track">
                        <div className="project-progress-fill" style={{ width: `${item.progress}%` }} />
                      </div>
                    </div>
                  </div>
                </div>
              </ScrollReveal>
            ))}
          </div>

          <ScrollReveal>
            <div className="section-header">
              <div>
                <div className="section-label">{f.activities_label}</div>
                <h2
                  className="section-title"
                  style={{ fontFamily: "var(--font-playfair)" }}
                >
                  <RichText text={f.activities_title} />
                </h2>
              </div>
            </div>
          </ScrollReveal>

          <div className="activities-grid">
            {activities.map((item, i) => {
              const d = item.date ? new Date(item.date) : null;
              return (
                <ScrollReveal key={item.id} delay={i + 1}>
                  <div className="activity-card">
                    {d && <div className="activity-date-block">
                      <div className="activity-date-day">{d.getDate()}</div>
                      <div className="activity-date-month">{d.toLocaleDateString('en-US', { month: 'short' })}</div>
                      {item.start_time && <div className="activity-time">{formatTime12(item.start_time)}</div>}
                    </div>}
                    <div>
                      <h3 className="activity-title">{item.title}</h3>
                      <p className="activity-desc">{item.details}</p>
                      {item.location && <p className="activity-desc" style={{ fontSize: '0.875rem', marginTop: '0.5rem', opacity: 0.7 }}>{item.location}</p>}
                    </div>
                  </div>
                </ScrollReveal>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
