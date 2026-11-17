import { useEffect } from "react";
import { motion, useReducedMotion } from "motion/react";
import Crest, { DRAW } from "../components/Crest.jsx";

export const OPENING_FULL_MS = DRAW.done * 1000 + 450;
export const OPENING_QUICK_MS = 650;
export const OPENING_REDUCED_MS = 500;

export default function Opening({ quick, onDone }) {
  const reduced = useReducedMotion();

  useEffect(() => {
    const ms = reduced ? OPENING_REDUCED_MS : quick ? OPENING_QUICK_MS : OPENING_FULL_MS;
    const timer = setTimeout(onDone, ms);
    return () => clearTimeout(timer);
  }, [reduced, quick, onDone]);

  return (
    <motion.div
      className="opening"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
    >
      <Crest draw={!quick && !reduced} height={168} label="The crest of the Uniting Presbyterian Church in Zambia" />
      <p className="t-overline opening-word">Uniting Presbyterian Church in Zambia</p>
    </motion.div>
  );
}
