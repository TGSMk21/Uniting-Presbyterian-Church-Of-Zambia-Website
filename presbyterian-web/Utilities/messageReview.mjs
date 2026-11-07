// Reviewing a daily message (AGENT_EXECUTION_PLAN.md, Task 7.3): see it as the website will
// show it, then publish or turn it down. The API checks everything again.

const ACTIONS = {
  pending_review: [
    { status: "published", label: "Publish", kind: "primary" },
    { status: "rejected", label: "Turn down", kind: "danger" },
  ],
  published: [{ status: "pending_review", label: "Unpublish", kind: "secondary" }],
  rejected: [{ status: "pending_review", label: "Back to draft", kind: "secondary" }],
};

export function reviewActions(status) {
  return ACTIONS[status] || [];
}

export function statusLabel({ status, ai_generated: ai }) {
  if (status === "published") return { text: "Published", tone: "success" };
  if (status === "rejected") return { text: "Turned down", tone: "neutral" };
  return ai ? { text: "AI draft", tone: "warning" } : { text: "Draft", tone: "neutral" };
}

export function messageParagraphs(text) {
  return String(text || "").split(/\n\s*\n/).map((part) => part.trim()).filter(Boolean);
}
