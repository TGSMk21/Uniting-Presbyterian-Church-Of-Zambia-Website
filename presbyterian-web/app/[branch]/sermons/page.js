import { ScrollReveal } from "@/components/UniversalComponents/scroll-reveal";
import RichText from "@/components/UniversalComponents/rich-text";
import { getPageContent, getSermons } from "@/Services/api";
import { pageFields } from "@/Utilities/pageContent.mjs";

export const revalidate = 3600;

export default async function Sermons({ params, searchParams }) {
  const { branch } = await params;
  const page = Math.max(1, parseInt((await searchParams)?.page, 10) || 1);
  const [data, content] = await Promise.all([getSermons(branch, page), getPageContent(branch)]);
  const f = pageFields("branch", "sermons", content?.pages?.sermons);
  const archives = data?.results || [];
  return (
    <div className="container mx-auto max-w-full overflow-hidden min-w-full min-h-screen w-full">
      <section className="page-banner">
        <div className="page-banner-inner">
          <span className="page-banner-label">{f.banner_label}</span>
          <h1 style={{ fontFamily: "var(--font-playfair)" }}>
            <RichText text={f.banner_title} />
          </h1>
          <p className="page-banner-desc">{f.banner_text}</p>
        </div>
      </section>

      <section className="sermons-content">
        <div className="sermons-inner">
          <ScrollReveal>
            {(() => {
              const live = archives.find(s => s.is_live);
              if (live) {
                return (
                  <div className="live-card">
                    <div>
                      <div className="live-indicator">
                        <span className="live-dot" />
                        Live Now
                      </div>
                      <h3 className="live-title">{live.title}</h3>
                      <a className="live-cta" href={`/${branch}/sermons/${live.video_id}`}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                        Join Live Stream
                      </a>
                    </div>
                    <div className="live-info">
                      {live.series && <div className="live-info-item">
                        <div className="live-info-label">Series</div>
                        <div className="live-info-value">{live.series}</div>
                      </div>}
                      {live.reference_verse && <div className="live-info-item">
                        <div className="live-info-label">Reference</div>
                        <div className="live-info-value">{live.reference_verse}</div>
                      </div>}
                    </div>
                  </div>
                );
              }
              return (
                <div className="live-card live-card-offline">
                  <div>
                    <h3 className="live-title">{f.offline_title}</h3>
                    <p className="live-preacher">{f.offline_text}</p>
                    <a className="live-cta" href="#archive">{f.offline_button}</a>
                  </div>
                </div>
              );
            })()}
          </ScrollReveal>

          <div className="section-header" id="archive">
            <div>
              <span className="section-label">{f.archive_label}</span>
              <h2 className="section-title"><RichText text={f.archive_title} /></h2>
            </div>
          </div>

          <div className="archive-grid">
            {archives.map((item, index) => (
              <ScrollReveal key={item.id || index} delay={(index % 3) + 1}>
                <a href={`/${branch}/sermons/${item.video_id}`} className="archive-card">
                  <div className="archive-thumb">
                    {item.video_id && (
                      <img src={`https://img.youtube.com/vi/${item.video_id}/mqdefault.jpg`} alt={item.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    )}
                  </div>
                  <div className="archive-body">
                    {item.series && <div className="archive-series">{item.series}</div>}
                    <h3 className="archive-title">{item.title}</h3>
                    <div className="archive-meta">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                        <line x1="16" y1="2" x2="16" y2="6" />
                        <line x1="8" y1="2" x2="8" y2="6" />
                        <line x1="3" y1="10" x2="21" y2="10" />
                      </svg>
                      {item.preached_at ? new Date(item.preached_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''}
                    </div>
                  </div>
                </a>
              </ScrollReveal>
            ))}
          </div>

          {(data?.previous || data?.next) && (
            <nav className="archive-pager" style={{ display: "flex", justifyContent: "space-between", marginTop: "2.5rem" }}>
              {data.previous ? <a className="btn-ghost" href={`/${branch}/sermons?page=${page - 1}#archive`}>← Newer sermons</a> : <span />}
              {data.next && <a className="btn-ghost" href={`/${branch}/sermons?page=${page + 1}#archive`}>Older sermons →</a>}
            </nav>
          )}
        </div>
      </section>
    </div>
  );
}
