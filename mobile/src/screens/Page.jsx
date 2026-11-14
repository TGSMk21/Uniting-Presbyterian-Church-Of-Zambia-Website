// A page opened on top of the tabs (profile, settings, favourites). It slides in from the
// right and leaves the same way (apple-design §7: enter and exit along the same path).
import { motion, useReducedMotion } from "motion/react";
import { ArrowLeft } from "@phosphor-icons/react/dist/csr/ArrowLeft";
import { FADE, SPRING } from "../lib/motion.js";

export default function Page({ title, onBack, children }) {
  const reduced = useReducedMotion();
  return (
    <motion.section
      className="page"
      aria-label={title}
      initial={reduced ? { opacity: 0 } : { x: "100%" }}
      animate={reduced ? { opacity: 1 } : { x: 0 }}
      exit={reduced ? { opacity: 0 } : { x: "100%" }}
      transition={reduced ? FADE : SPRING}
    >
      <header className="page-bar">
        <button type="button" className="icon-button" onClick={onBack} aria-label="Back">
          <ArrowLeft size={24} />
        </button>
        <h1 className="page-bar-title">{title}</h1>
      </header>
      <div className="page-body">{children}</div>
    </motion.section>
  );
}
