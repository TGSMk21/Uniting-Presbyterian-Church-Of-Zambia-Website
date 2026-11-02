import { formatYouTubeDuration } from "@/Utilities/durationFomar";
import { BookOpenText, Calendar, Clock, ArrowLeft } from "lucide-react";
import { getSermonByVideoId, getSermons } from "@/Services/api";
import { dateFormat } from "@/Utilities/DateFormatter";
import Link from "next/link";
import { notFound } from "next/navigation";

const RELATED_LIMIT = 10;

export const revalidate = 3600;

export default async function VidPlayerPage({ id, branch }) {
  const videoId = await id;

  // Sermons (and their YouTube details) are synced into Django by the
  // backend's sync_youtube job, so the page needs no YouTube API calls.
  const [sermon, sermonList] = await Promise.all([
    getSermonByVideoId(branch, videoId),
    getSermons(branch),
  ]);
  // Only play videos that belong to this branch.
  if (!sermon) notFound();

  const related = (sermonList?.results || [])
    .filter((s) => s.video_id && s.video_id !== videoId)
    .slice(0, RELATED_LIMIT);

  const { title, series, reference_verse: refVerse, description, preached_at: publishedAt, duration } = sermon;

  return (
    <div className="sermon-player">
      <div className="sermon-player-inner">
        <Link href={`/${branch}/sermons`} className="sermon-player-back">
          <ArrowLeft size={16} /> Back to Sermons
        </Link>

        <div className="sermon-player-grid">
          <div className="sermon-player-main">
            <div className="sermon-video">
              <iframe
                src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`}
                title={title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            </div>

            <div className="sermon-info">
              {series && <span className="sermon-series">{series}</span>}
              <h1 className="sermon-title">{title}</h1>

              <div className="sermon-meta">
                {publishedAt && (
                  <span className="sermon-meta-item">
                    <Calendar size={15} /> {dateFormat(publishedAt).fullDate}
                  </span>
                )}
                {duration && (
                  <span className="sermon-meta-item">
                    <Clock size={15} /> {formatYouTubeDuration(duration)}
                  </span>
                )}
                {refVerse && (
                  <span className="sermon-meta-item">
                    <BookOpenText size={15} /> {refVerse}
                  </span>
                )}
              </div>

              <hr className="sermon-divider" />

              <h2 className="sermon-about-title">About This Sermon</h2>
              <p className="sermon-desc">{description}</p>
            </div>
          </div>

          <aside className="sermon-related">
            <h2 className="sermon-related-title">More Sermons</h2>
            <div className="sermon-related-list">
              {related.map((item) => (
                <Link
                  key={item.id}
                  href={`/${branch}/sermons/${item.video_id}`}
                  className="sermon-related-item"
                >
                  <div
                    className="sermon-related-thumb"
                    style={{ backgroundImage: `url(https://img.youtube.com/vi/${item.video_id}/hqdefault.jpg)` }}
                  >
                    {item.duration && <span>{formatYouTubeDuration(item.duration)}</span>}
                  </div>
                  <div className="sermon-related-info">
                    <h3>{item.title}</h3>
                    <span className="sermon-related-date">
                      <Calendar size={13} /> {dateFormat(item.preached_at).fullDate}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
