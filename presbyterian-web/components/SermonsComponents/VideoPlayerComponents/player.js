import { formatYouTubeDuration } from "@/Utilities/durationFomar";
import { getVideos } from "@/Services/Sermons/youtube";
import { BookOpenText, Calendar, Clock, ArrowLeft } from "lucide-react";
import { getSermonByVideoId } from "@/Services/api";
import { dateFormat } from "@/Utilities/DateFormatter";
import Link from "next/link";

export const revalidate = 3600;

export default async function VidPlayerPage({ id, branch }) {
  const videoId = await id;

  const [sermonDb, videos] = await Promise.all([
    getSermonByVideoId(branch, videoId),
    getVideos(process.env.YOUTUBE_CHANNEL_ID),
  ]);

  const ytVideo = videos?.find((v) => v.id === videoId);
  const related = videos?.filter((v) => v.id !== videoId) || [];

  const title = sermonDb?.title || ytVideo?.snippet?.title || "Sermon";
  const series = sermonDb?.series || "";
  const refVerse = sermonDb?.reference_verse || "";
  const description = sermonDb?.description || ytVideo?.snippet?.description || "";
  const publishedAt = ytVideo?.snippet?.publishedAt;
  const duration = ytVideo?.contentDetails?.duration;

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
              {related.map((item) => {
                const thumb = item.snippet?.thumbnails?.high?.url || item.snippet?.thumbnails?.medium?.url;
                return (
                  <Link
                    key={item.id}
                    href={`/${branch}/sermons/${item.id}`}
                    className="sermon-related-item"
                  >
                    <div
                      className="sermon-related-thumb"
                      style={thumb ? { backgroundImage: `url(${thumb})` } : undefined}
                    >
                      <span>{formatYouTubeDuration(item.contentDetails.duration)}</span>
                    </div>
                    <div className="sermon-related-info">
                      <h3>{item.snippet.title}</h3>
                      <span className="sermon-related-date">
                        <Calendar size={13} /> {dateFormat(item.snippet.publishedAt).fullDate}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
