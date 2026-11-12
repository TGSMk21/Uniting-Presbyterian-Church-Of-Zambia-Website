import { Download, ExternalLink } from "lucide-react";
import { FILE_LABELS, sizeText, viewerKind } from "@/Utilities/documents.mjs";

function Runs({ runs }) {
  return runs.map((run, index) => {
    let node = run.text;
    if (run.u) node = <u>{node}</u>;
    if (run.i) node = <em>{node}</em>;
    if (run.b) node = <strong>{node}</strong>;
    return <span key={index}>{node}</span>;
  });
}

// A Word file as headings, paragraphs, lists and tables. Every piece is text drawn by
// React, so nothing in the file can run on the page.
function WordBlocks({ blocks }) {
  const out = [];
  let list = [];
  const flush = () => {
    if (list.length) out.push(<ul key={`l${out.length}`}>{list}</ul>);
    list = [];
  };
  blocks.forEach((block, index) => {
    if (block.type === "item") {
      list.push(<li key={index}><Runs runs={block.runs} /></li>);
      return;
    }
    flush();
    if (block.type === "heading") {
      const Tag = `h${Math.min(4, (block.level || 1) + 1)}`;
      out.push(<Tag key={index}><Runs runs={block.runs} /></Tag>);
    } else if (block.type === "table") {
      out.push(
        <div key={index} className="ws-doc-table"><table><tbody>
          {block.rows.map((row, r) => <tr key={r}>{row.map((cell, c) => <td key={c}>{cell}</td>)}</tr>)}
        </tbody></table></div>,
      );
    } else if (block.type === "more") {
      out.push(<p key={index} className="dash-help">The rest of this file is in the download.</p>);
    } else {
      out.push(<p key={index}><Runs runs={block.runs} /></p>);
    }
  });
  flush();
  return out;
}

// Shows a document the way its kind allows (decision D8.7). `file` is this site's own
// checked address for the file; `preview` is the API's preview answer, when there is one.
export default function DocumentViewer({ document, version, file, preview }) {
  const kind = viewerKind(version.file_type);
  const download = (
    <a href={file} className="btn-ghost" download={version.filename || undefined}>
      <Download size={16} aria-hidden="true" /> Download{version.size ? ` (${sizeText(version.size)})` : ""}
    </a>
  );

  if (kind === "written" || kind === "text") {
    return <article className="ws-doc-page ws-doc-text">{preview?.text}</article>;
  }
  if (kind === "word" && preview?.blocks?.length) {
    return (
      <>
        <article className="ws-doc-page ws-doc-word"><WordBlocks blocks={preview.blocks} /></article>
        <div className="ws-actions">{download}</div>
        <p className="dash-help">This is a readable preview. Download the file to see its exact layout.</p>
      </>
    );
  }
  if (kind === "image") {
    return (
      <>
        {/* eslint-disable-next-line @next/next/no-img-element -- a private file from this site, not for the image optimiser */}
        <img src={file} alt={document.title} className="ws-doc-image" />
        <div className="ws-actions">{download}</div>
      </>
    );
  }
  if (kind === "pdf") {
    return (
      <>
        <iframe src={file} title={document.title} className="ws-doc-frame" />
        <div className="ws-actions">
          <a href={file} target="_blank" rel="noopener" className="btn-primary ws-doc-open">
            <ExternalLink size={16} aria-hidden="true" /> Open the PDF
          </a>
          {download}
        </div>
      </>
    );
  }
  return (
    <div className="ws-doc-download">
      <p className="dash-text">
        {FILE_LABELS[version.file_type] ?? "This"} files open on your device. Download it to read it.
      </p>
      <div className="ws-actions">{download}</div>
    </div>
  );
}
