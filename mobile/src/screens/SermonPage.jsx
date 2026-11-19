import { useState } from "react";
import { Play } from "@phosphor-icons/react/dist/csr/Play";
import { ShareNetwork } from "@phosphor-icons/react/dist/csr/ShareNetwork";
import Page from "./Page.jsx";
import { openExternally, youtubeWatchUrl } from "../lib/links.js";
import { shareText } from "../lib/share.js";
import HeartButton from "../components/HeartButton.jsx";
import { isFaved, sermonFavItem } from "../lib/favourites.js";

const dayLabel = (iso) =>
  new Date(`${String(iso).slice(0, 10)}T12:00:00`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

export default function SermonPage({ sermon, onBack, favs, onToggleFav }) {
  const [shared, setShared] = useState(false);
  const onShare = async () => {
    const result = await shareText({
      title: sermon.title,
      text: [sermon.title, sermon.reference_verse, sermon.video_id ? youtubeWatchUrl(sermon.video_id) : ""]
        .filter(Boolean).join("\n"),
    });
    if (result === "copied" || result === "shared") {
      setShared(true);
      setTimeout(() => setShared(false), 2000);
    }
  };

  return (
    <Page title="Sermon" onBack={onBack}>
      <article className="message-article selectable">
        <div className="card-head">
          <p className={`t-overline${sermon.is_live ? " live-overline" : ""}`}>{sermon.is_live ? "Live now" : "Sermon"}</p>
          <HeartButton active={isFaved(favs, "sermons", sermon.video_id)} onToggle={() => onToggleFav("sermons", sermonFavItem(sermon))} label="Save this sermon" />
        </div>
        <h2 className="t-title">{sermon.title}</h2>
        <p className="t-caption">
          {[sermon.minister_name, dayLabel(sermon.preached_at), sermon.reference_verse].filter(Boolean).join(" · ")}
        </p>
      </article>
      <div className="form-actions">
        {sermon.video_id ? (
          <button type="button" className="button button-primary" onClick={() => openExternally(youtubeWatchUrl(sermon.video_id))}>
            <Play size={20} weight="fill" /> Watch the sermon
          </button>
        ) : (
          <p className="t-callout">No video is linked to this sermon yet.</p>
        )}
        {sermon.video_id && (
          <button type="button" className="button button-quiet" onClick={onShare}>
            <ShareNetwork size={18} /> {shared ? "Copied" : "Share the video"}
          </button>
        )}
      </div>
    </Page>
  );
}
