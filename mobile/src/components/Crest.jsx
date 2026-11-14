// The church crest as live shapes, so it can be drawn in (MOBILE_APP_PLAN.md, spec 2).
// The cross is traced as a pen line, the navy flames rise, the red flames sweep up, then
// the cross fills. With "reduce motion" it simply fades in.
import { motion, useReducedMotion } from "motion/react";
import { CREST_SIZE, CROSS, NAVY, RED, WHITE } from "./crestPaths.js";

const INK = "#141414";
const CREST_NAVY = "#1c266d";
const CREST_RED = "#ce2b26";

// The choreography, in seconds from the start.
export const DRAW = { stroke: 0, strokeFor: 0.95, navy: 0.5, red: 0.78, fill: 0.95, done: 1.55 };
const EASE = [0.65, 0, 0.35, 1];
const RISE = { type: "spring", bounce: 0.1, duration: 0.7 };

function rise(delay, reduced) {
  if (reduced) return { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.3, delay: 0.1 } };
  return {
    initial: { opacity: 0, scaleY: 0.55, y: 10 },
    animate: { opacity: 1, scaleY: 1, y: 0 },
    transition: { ...RISE, delay, opacity: { duration: 0.35, delay } },
  };
}

export default function Crest({ draw = false, height = 132, onDrawn, label = "The church crest", className = "" }) {
  const reduced = useReducedMotion();
  const width = (height * CREST_SIZE.width) / CREST_SIZE.height;
  const still = !draw;
  const box = { transformBox: "fill-box", transformOrigin: "50% 100%" };

  return (
    <svg
      className={`crest ${className}`.trim()}
      viewBox={`0 0 ${CREST_SIZE.width} ${CREST_SIZE.height}`}
      width={width}
      height={height}
      role="img"
      aria-label={label}
    >
      <g>
        {NAVY.map((d, i) => (
          <motion.path key={`n${i}`} d={d} fill={CREST_NAVY} style={box}
            {...(still ? {} : rise(DRAW.navy + i * 0.05, reduced))} />
        ))}
        {RED.map((d, i) => (
          <motion.path key={`r${i}`} d={d} fill={CREST_RED} style={box}
            {...(still ? {} : rise(DRAW.red + i * 0.07, reduced))} />
        ))}
      </g>
      <motion.g
        {...(still ? {} : reduced
          ? { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.3, delay: 0.1 } }
          : { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.32, delay: DRAW.fill, ease: EASE } })}
        onAnimationComplete={still ? undefined : onDrawn}
      >
        {CROSS.map((d, i) => <path key={`c${i}`} d={d} fill={INK} />)}
        {WHITE.map((d, i) => <path key={`w${i}`} d={d} fill="#fff" />)}
      </motion.g>
      {draw && !reduced && CROSS.slice(0, 1).map((d) => (
        // The pen line that draws the cross, then gives way to the filled cross.
        <motion.path key="pen" d={d} fill="none" stroke="var(--brand)" strokeWidth={2.2}
          strokeLinecap="round" strokeLinejoin="round"
          initial={{ pathLength: 0, opacity: 1 }}
          animate={{ pathLength: 1, opacity: [1, 1, 0] }}
          transition={{
            pathLength: { duration: DRAW.strokeFor, ease: EASE, delay: DRAW.stroke },
            opacity: { duration: DRAW.fill + 0.35, times: [0, 0.8, 1] },
          }} />
      ))}
    </svg>
  );
}
