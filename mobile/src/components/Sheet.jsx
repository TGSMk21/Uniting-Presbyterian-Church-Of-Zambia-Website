// A bottom sheet that follows the finger (apple-design skill §2–§6): 1:1 drag, rubber-band
// at the top, momentum decides whether it closes, and it can be grabbed mid-flight.
// Events and announcements open their details in this (specs 10 and 14).
import { useEffect, useId, useRef } from "react";
import { AnimatePresence, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import { sheetShouldClose } from "../lib/gestures.js";
import { FADE, SPRING_SHEET } from "../lib/motion.js";
import { tap } from "../lib/device.js";

export default function Sheet({ open, onClose, title, children }) {
  const titleId = useId();
  const reduced = useReducedMotion();
  const y = useMotionValue(0);
  const panel = useRef(null);
  const height = () => panel.current?.offsetHeight || 600;
  const scrim = useTransform(y, (value) => 1 - Math.min(1, Math.max(0, value) / height()));

  useEffect(() => {
    if (!open) return undefined;
    // Focus moves into the sheet, and back to whatever opened it when it closes.
    const opener = document.activeElement;
    const key = (event) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", key);
    panel.current?.focus({ preventScroll: true });
    return () => {
      window.removeEventListener("keydown", key);
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus({ preventScroll: true });
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="sheet-layer" key="sheet">
          {/* The outer layer fades the dimming in and out; the inner one lightens as the sheet is dragged down. */}
          <motion.div className="sheet-scrim-fade" onClick={onClose}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={FADE}>
            <motion.div className="sheet-scrim" style={{ opacity: scrim }} />
          </motion.div>
          <motion.section
            ref={panel}
            className="sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            style={{ y }}
            initial={reduced ? { opacity: 0 } : { y: "100%" }}
            animate={reduced ? { opacity: 1 } : { y: 0 }}
            exit={reduced ? { opacity: 0 } : { y: "100%" }}
            transition={reduced ? FADE : SPRING_SHEET}
            drag={reduced ? false : "y"}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.05, bottom: 1 }}
            dragMomentum={false}
            onDragEnd={(_, info) => {
              if (sheetShouldClose({ offset: info.offset.y, velocity: info.velocity.y, height: height() })) {
                tap();
                onClose();
              }
            }}
          >
            <div className="sheet-grip" aria-hidden="true" />
            <h2 id={titleId} className="t-title sheet-title">{title}</h2>
            <div className="sheet-body selectable">{children}</div>
          </motion.section>
        </div>
      )}
    </AnimatePresence>
  );
}
