export function homeKey(branchSlug) {
  return `upcz.home.${branchSlug}`;
}

export function timeAgo(at, now) {
  const diff = Math.max(0, now - at);
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return minutes === 1 ? "1 minute ago" : `${minutes} minutes ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours === 1 ? "1 hour ago" : `${hours} hours ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  return new Date(at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

export function homeSlots(data) {
  const slots = ["greeting"];
  if (data?.live) slots.push("live");
  if (data?.events?.some((event) => event.date === data.date)) slots.push("today-event");
  if (data?.verse) slots.push("verse");
  if (data?.daily_message) slots.push("message");
  if (data?.sermons?.length) slots.push("sermons");
  if (data?.events?.length) slots.push("events");
  return slots;
}
