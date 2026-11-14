// Measuring smoothness: a frame is "dropped" if it took longer than one and a half normal
// frames (25 ms on a 60 Hz screen). Used by the Smoothness test page.
export const DROPPED_MS = 25;

export function summarizeFrames(times) {
  if (!times.length) return { frames: 0, smoothShare: 1, worst: 0, fps: 0 };
  const smooth = times.filter((t) => t <= DROPPED_MS).length;
  const total = times.reduce((sum, t) => sum + t, 0);
  return {
    frames: times.length,
    smoothShare: Math.round((smooth / times.length) * 100) / 100,
    worst: Math.max(...times),
    fps: Math.round((times.length / total) * 1000),
  };
}

export function verdict({ frames, smoothShare }) {
  if (frames < 30) return "not enough to tell";
  if (smoothShare >= 0.95) return "smooth";
  if (smoothShare >= 0.85) return "mostly smooth";
  return "not smooth";
}
