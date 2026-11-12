// The document hub (AGENT_EXECUTION_PLAN.md, Task 8.5): plain helpers for the pages.
// The API decides who may read, change and share; this only arranges things.
import { SYNOD_NAME } from "./workspace.mjs";

export const MAX_UPLOAD = 4_000_000;
export const MAX_TEXT = 100_000;

export const FILE_LABELS = {
  pdf: "PDF", docx: "Word", xlsx: "Excel", pptx: "PowerPoint", image: "Picture", txt: "Text", written: "Written here",
};

const VIEWERS = { pdf: "pdf", image: "image", docx: "word", txt: "text", written: "written" };

export function viewerKind(fileType) {
  return VIEWERS[fileType] ?? "download";
}

export function sizeText(bytes) {
  if (!bytes) return "";
  if (bytes < 1_000_000) return `${Math.max(1, Math.round(bytes / 1000))} KB`;
  return `${(bytes / 1_000_000).toFixed(1)} MB`;
}

// The new-document form, checked before it's sent: a file to upload, or words written here.
export function documentFromForm(formData) {
  const title = String(formData.get("title") ?? "").trim().slice(0, 200);
  if (!title) return { error: "Please give the document a name." };
  const description = String(formData.get("description") ?? "").trim().slice(0, 1000);
  if (formData.get("mode") === "text") {
    const text = String(formData.get("text") ?? "");
    if (!text.trim()) return { error: "Please write the words of the document." };
    if (text.length > MAX_TEXT) return { error: "This is too long for one document. Please split it into parts." };
    return { body: { title, description, text } };
  }
  const file = formData.get("file");
  if (!file || typeof file === "string" || file.size === 0) return { error: "Please choose the file to upload." };
  if (file.size > MAX_UPLOAD) return { error: "This file is too large. Files can be up to 4 MB." };
  const data = new FormData();
  data.append("title", title);
  data.append("description", description);
  data.append("file", file, file.name);
  return { formData: data };
}

// The groups someone may share with (from the API's share-options).
export function groupChoices(options) {
  if (!options) return [];
  return [
    ...(options.branch ? [{ label: `Everyone at ${options.branch.name}`, target: { kind: "branch", branch: options.branch.slug } }] : []),
    ...(options.presbytery ? [{ label: `Everyone in ${options.presbytery.name} Presbytery`,
      target: { kind: "presbytery", presbytery: options.presbytery.slug } }] : []),
    ...(options.synod ? [{ label: "The whole synod", target: { kind: "synod" }, title: SYNOD_NAME }] : []),
  ];
}
