import { motion, useReducedMotion } from "motion/react";
import { Heart } from "@phosphor-icons/react/dist/csr/Heart";
import { Haptics, ImpactStyle } from "@capacitor/haptics";
import { isNative } from "../lib/device.js";

// A small, satisfying heart: a pop when it turns on and a light vibration where the phone allows it.
export default function HeartButton({ active, onToggle, label = "Favourite" }) {
  const reduced = useReducedMotion();

  return (
    <button type="button" className={`heart-button${active ? " heart-on" : ""}`}
      aria-pressed={active} aria-label={`${label}${active ? " (saved)" : ""}`}
      onClick={(event) => {
        event.stopPropagation();
        if (!active && isNative()) Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
        onToggle();
      }}>
      <motion.span
        key={active ? "on" : "off"}
        initial={false}
        animate={reduced ? {} : active ? { scale: [1, 1.35, 1] } : { scale: 1 }}
        transition={{ duration: 0.28, ease: "easeOut" }}
        className="heart-icon"
      >
        <Heart size={22} weight={active ? "fill" : "regular"} />
      </motion.span>
    </button>
  );
}
