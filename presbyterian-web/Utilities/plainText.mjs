// The church doesn't use em dashes in its writing (owner's request, 2026-11-08).
// Wording typed in the dashboard, or written by the daily message writer, may still
// have them, so text is cleaned as it's shown: "near you — a place" → "near you, a place".

export function plainDashes(text) {
  return String(text ?? "").replace(/\s*—\s*/g, ", ");
}
