export async function shareText({ title, text }) {
  const nav = globalThis.navigator;
  if (nav?.share) {
    try {
      await nav.share({ title, text });
      return "shared";
    } catch (error) {
      if (error?.name === "AbortError") return "cancelled";
    }
  }
  if (nav?.clipboard?.writeText) {
    try {
      await nav.clipboard.writeText([title, text].filter(Boolean).join("\n\n"));
      return "copied";
    } catch {
      return "failed";
    }
  }
  return "failed";
}
