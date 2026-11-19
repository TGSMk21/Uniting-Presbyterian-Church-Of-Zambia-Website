import { useState } from "react";
import { motion } from "motion/react";
import { ShareNetwork } from "@phosphor-icons/react/dist/csr/ShareNetwork";
import Page from "./Page.jsx";
import { shareText } from "../lib/share.js";

export default function MessagePage({ message, onBack }) {
  const [shared, setShared] = useState(false);
  const paragraphs = message.message.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const onShare = async () => {
    const result = await shareText({
      title: message.title,
      text: [message.title, message.reference_verse, message.message].filter(Boolean).join("\n\n"),
    });
    if (result === "copied" || result === "shared") {
      setShared(true);
      setTimeout(() => setShared(false), 2000);
    }
  };

  return (
    <Page title="Daily message" onBack={onBack}>
      <article className="message-article selectable">
        <motion.h2 layoutId={`message-title-${message.id}`} className="t-title">{message.title}</motion.h2>
        {message.reference_verse && <p className="t-caption message-ref">{message.reference_verse}</p>}
        {paragraphs.map((p, i) => (
          <p key={i} className="t-body message-para">{p}</p>
        ))}
      </article>
      <div className="form-actions">
        <button type="button" className="button button-quiet" onClick={onShare}>
          <ShareNetwork size={18} /> {shared ? "Copied" : "Share this message"}
        </button>
      </div>
    </Page>
  );
}
