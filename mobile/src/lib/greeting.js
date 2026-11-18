export const PARTS = ["early-morning", "morning", "afternoon", "evening", "night"];

export function partOfDay(date) {
  const hour = date.getHours();
  if (hour >= 5 && hour < 8) return "early-morning";
  if (hour >= 8 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 22) return "evening";
  return "night";
}

export const GREETINGS = {
  "early-morning": [
    "A new morning, {name}. God's mercies are new every day.",
    "Early and bright, {name}. The Lord is awake before us.",
    "Good morning, {name}. This day is a gift.",
    "Rise gently, {name}. Grace meets you here.",
    "Morning light, {name}. Today He is faithful.",
  ],
  morning: [
    "Good morning, {name}.",
    "Morning, {name}. May your day be fruitful.",
    "Good morning, {name}. Walk in His peace today.",
    "Morning, {name}. You are blessed, and a blessing.",
    "Good morning, {name}. The sun rises, and so does hope.",
  ],
  afternoon: [
    "Good afternoon, {name}.",
    "Afternoon, {name}. May the rest of your day be kind.",
    "Good afternoon, {name}. Keep going; grace is near.",
    "Afternoon, {name}. Christ is with you.",
    "Good afternoon, {name}. A steady heart, a grateful mind.",
  ],
  evening: [
    "Good evening, {name}.",
    "Evening, {name}. Thank God for today.",
    "Good evening, {name}. Rest well tonight.",
    "Evening, {name}. The day's work is done; peace be with you.",
    "Good evening, {name}. His mercies come again tomorrow.",
  ],
  night: [
    "It's late, {name}. Rest in the Lord tonight.",
    "Night, {name}. He guards your sleep.",
    "Good night, {name}. Sleep in peace.",
    "The night is quiet, {name}. The Lord watches over you.",
    "Good night, {name}. See you in the morning.",
  ],
};

export function pickGreeting(part, lastIndex, rng = Math.random) {
  const pool = GREETINGS[part] ?? GREETINGS.morning;
  let index = Math.floor(rng() * pool.length);
  if (pool.length > 1 && index === lastIndex) index = (index + 1) % pool.length;
  return { index, text: pool[index] };
}

export function fillName(text, name) {
  return text
    .replaceAll("{name}", name ?? "")
    .replace(/,\s*\./g, ".")
    .replace(/,\s*$/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}
