export const MODES = { opening: "opening", firstRun: "first-run", app: "app" };

export function initialMode({ seenOpening, firstRunDone }) {
  if (!seenOpening) return MODES.opening;
  if (!firstRunDone) return MODES.firstRun;
  return MODES.app;
}

export function completeOpening(state) {
  return { ...state, seenOpening: true };
}

export function completeFirstRun(state, profile) {
  return { ...state, firstRunDone: true, profile };
}
