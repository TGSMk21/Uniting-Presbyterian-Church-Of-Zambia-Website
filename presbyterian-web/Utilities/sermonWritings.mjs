// Adding pastors' sermon files in the dashboard (AGENT_EXECUTION_PLAN.md, Task 4.1).
// The API reads every file and checks it again; this only saves a wasted upload.

// The website's host refuses requests over 4.5 MB.
export const SERMON_MAX_BYTES = 4_000_000;
export const SERMON_ACCEPT = ".docx,.pdf,.txt";

const TOO_LARGE = "This file is too large. Files can be up to 4 MB.";
const NOT_ALLOWED = "This kind of file can't be read. Please choose a Word (.docx), PDF or plain text (.txt) file.";
const OLD_WORD = "This is an older Word file. Save it as a .docx in Word (File, Save As), then add that one.";
const TRY_AGAIN = "This file couldn't be added right now. Please try again in a moment.";

function extension(name) {
  const match = /\.([A-Za-z0-9]+)$/.exec(name || "");
  return match ? match[1].toLowerCase() : "";
}

// A message to show instead of uploading, or null when the file can be sent.
export function checkSermonFile(file) {
  if (!file) return "Please choose a file.";
  if (file.size === 0) return "This file is empty.";
  if (file.size > SERMON_MAX_BYTES) return TOO_LARGE;
  const kind = extension(file.name);
  if (kind === "doc") return OLD_WORD;
  if (!["docx", "pdf", "txt"].includes(kind)) return NOT_ALLOWED;
  return null;
}

// What to tell staff when the API refuses a file.
export function sermonUploadFailure(status, data) {
  if (status === 401) return { signedOut: true };
  if (status === 403) return { error: "You can't change this branch's content." };
  if (status === 413) return { error: TOO_LARGE };
  if (status === 400 && data && typeof data === "object") {
    if (data.file) return { error: [].concat(data.file).join(" ") };
    if (data.minister) return { error: "Please choose one of your ministers." };
    const text = Object.values(data).flat().join(" ");
    if (text) return { error: text };
  }
  return { error: TRY_AGAIN };
}

export function uploadSummary(results) {
  const added = results.filter((result) => result.ok).length;
  const failed = results.length - added;
  if (!added) return "Nothing was added: see below.";
  const done = `Added ${added} ${added === 1 ? "sermon" : "sermons"}.`;
  return failed ? `${done} ${failed} couldn't be added: see below.` : done;
}
