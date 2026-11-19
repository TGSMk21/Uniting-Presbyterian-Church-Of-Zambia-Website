import { useEffect } from "react";
import { useMotionValue } from "motion/react";

// Gentle 3D tilt from the phone's gyroscope, throttled to animation frames.
// Only used where it stays smooth: never under reduce motion or on low-end phones.
export function useDeviceTilt(enabled) {
  const rotateX = useMotionValue(0);
  const rotateY = useMotionValue(0);

  useEffect(() => {
    if (!enabled) return undefined;
    let frame = 0;
    const onOrientation = (event) => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const gamma = event.gamma ?? 0;
        const beta = event.beta ?? 0;
        rotateY.set(Math.max(-9, Math.min(9, gamma / 4)));
        rotateX.set(Math.max(-7, Math.min(7, -(beta - 45) / 6)));
      });
    };
    window.addEventListener("deviceorientation", onOrientation);
    return () => {
      window.removeEventListener("deviceorientation", onOrientation);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [enabled, rotateX, rotateY]);

  return { rotateX, rotateY };
}
