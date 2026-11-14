// Greeting by the time of day (spec 4). Phase 2 adds the full, rotating set of greetings.
export function partOfDay(date) {
  const hour = date.getHours();
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  return "evening";
}
