import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { FILE_LABELS, MAX_UPLOAD, documentFromForm, groupChoices, sizeText, viewerKind }
  from "../Utilities/documents.mjs";
import { workspaceAttention } from "../Utilities/deliverables.mjs";
import { navGroups } from "../Utilities/dashboardNav.mjs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

function form(values) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.append(key, value);
  return data;
}
const pdf = (bytes = 10) => new File([new Uint8Array(bytes)], "budget.pdf", { type: "application/pdf" });

test("each kind of file opens the right way", () => {
  assert.equal(viewerKind("pdf"), "pdf");
  assert.equal(viewerKind("image"), "image");
  assert.equal(viewerKind("docx"), "word");
  assert.equal(viewerKind("txt"), "text");
  assert.equal(viewerKind("written"), "written");
  assert.equal(viewerKind("xlsx"), "download");
  assert.equal(viewerKind("pptx"), "download");
  assert.equal(FILE_LABELS.docx, "Word");
});

test("sizes read plainly", () => {
  assert.equal(sizeText(900), "1 KB");
  assert.equal(sizeText(1_250_000), "1.3 MB");
  assert.equal(sizeText(0), "");
});

test("an upload is checked before it's sent", () => {
  const ok = documentFromForm(form({ mode: "file", title: " Budget ", description: "", file: pdf() }));
  assert.equal(ok.error, undefined);
  assert.equal(ok.formData.get("title"), "Budget");
  assert.equal(ok.formData.get("file").name, "budget.pdf");
  assert.match(documentFromForm(form({ mode: "file", title: "Budget", file: pdf(MAX_UPLOAD + 1) })).error, /4 MB/);
  assert.match(documentFromForm(form({ mode: "file", title: "Budget", file: new File([], "x.pdf") })).error, /choose/i);
  assert.match(documentFromForm(form({ mode: "file", title: " ", file: pdf() })).error, /name/i);
});

test("a written document sends its words", () => {
  const { body } = documentFromForm(form({ mode: "text", title: "Notice", text: "Dear all" }));
  assert.deepEqual(body, { title: "Notice", description: "", text: "Dear all" });
  assert.match(documentFromForm(form({ mode: "text", title: "Notice", text: "  " })).error, /words/i);
});

test("group choices follow where you belong", () => {
  const choices = groupChoices({ branch: { slug: "a1", name: "Chilanga" }, presbytery: { slug: "munali", name: "Munali" },
    synod: false });
  assert.deepEqual(choices.map((c) => [c.label, c.target]), [
    ["Everyone at Chilanga", { kind: "branch", branch: "a1" }],
    ["Everyone in Munali Presbytery", { kind: "presbytery", presbytery: "munali" }],
  ]);
  assert.equal(groupChoices({ synod: true }).at(-1).label, "The whole synod");
  assert.deepEqual(groupChoices(null), []);
});

test("new documents shared with you reach the Overview", () => {
  const items = workspaceAttention({ unread_documents: 2 });
  assert.deepEqual(items.map((i) => [i.text, i.href]), [["2 new documents shared with you", "/dashboard/documents?view=shared"]]);
});

test("everyone in the workspace finds Documents in the menu", () => {
  const items = (navGroups({ role: "elder", workspace_member: true }).find((g) => g.label === "Workspace")?.items ?? [])
    .map((i) => i.href);
  assert.ok(items.includes("/dashboard/documents"));
});

test("a document's file only ever comes through the checked address", () => {
  const route = read("app/dashboard/(staff)/documents/[id]/file/route.js");
  assert.match(route, /\/workspace\/documents\/\$\{id\}\/file\//);
  assert.match(route, /private, no-store/);
  assert.match(route, /isRowId\(id\)/);
});
