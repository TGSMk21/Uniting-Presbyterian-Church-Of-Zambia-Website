// The Overview's work list (AGENT_EXECUTION_PLAN.md, Task 7.3): what needs doing now,
// each linking to where it's done. The counts come from /api/staff-overview/.
const TIME_ZONE = "Africa/Lusaka";

const plural = (count, one, many) => `${count} ${count === 1 ? one : many}`;

function dayName(isoDate) {
  return new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" })
    .format(new Date(`${isoDate}T12:00:00Z`)).replace(",", "");
}

export function attentionItems({ tomorrow, branches = [], requests_waiting: requests }) {
  const items = [];
  if (requests) {
    items.push({ text: plural(requests, "access request waiting", "access requests waiting"), href: "/dashboard/requests", tone: "warning" });
  }
  const named = branches.length > 1;
  const label = (b, text) => (named ? `${b.name}: ${text}` : text);
  const base = (b) => `/dashboard/content/${encodeURIComponent(b.slug)}`;
  const later = [];
  for (const b of branches) {
    if (b.ai_drafts) {
      items.push({ text: label(b, `${plural(b.ai_drafts, "AI draft", "AI drafts")} to check`), href: `${base(b)}/messages?status=pending_review`, tone: "warning" });
    }
    if (!b.tomorrow_published) {
      later.push({ text: label(b, `No daily message published for tomorrow, ${dayName(tomorrow)}`), href: `${base(b)}/messages`, tone: "neutral" });
    }
    if (b.sermons_waiting) {
      later.push({
        text: label(b, `${plural(b.sermons_waiting, "sermon", "sermons")} being read for daily messages`),
        href: `${base(b)}/writings`, tone: "neutral",
      });
    }
  }
  // Daily message gaps before sermons waiting, branch by branch.
  later.sort((a, b) => (a.href.endsWith("/messages") === b.href.endsWith("/messages") ? 0 : a.href.endsWith("/messages") ? -1 : 1));
  return [...items, ...later];
}

export function greeting(name, now = new Date()) {
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone: TIME_ZONE }).format(now));
  const part = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
  const first = String(name || "").split(" ")[0];
  return `Good ${part}, ${first}`;
}
