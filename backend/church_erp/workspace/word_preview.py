"""A readable preview of a Word (.docx) file (Task 8.5, decision D8.7).

The page draws these blocks itself, so nothing from the file is ever treated as
HTML: headings, paragraphs (bold, italic, underline), list items and tables."""
import io
import zipfile
from xml.etree import ElementTree

from church_erp.ai_messages.sermon_text import MAX_WORD_XML

W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
MAX_BLOCKS = 3000
MAX_CHARACTERS = 300_000
HEADINGS = {"title": 1, "heading1": 1, "heading2": 2, "heading3": 3, "heading4": 3, "subtitle": 2}


class Unreadable(Exception):
    pass


def _on(props, name):
    """Is a formatting switch such as <w:b/> on? <w:b w:val="0"/> means off."""
    node = props.find(f"{W}{name}") if props is not None else None
    if node is None:
        return False
    return node.get(f"{W}val", "true").lower() not in ("0", "false", "none")


def _runs(paragraph):
    runs = []
    for run in paragraph.iter(f"{W}r"):
        props = run.find(f"{W}rPr")
        style = (_on(props, "b"), _on(props, "i"), _on(props, "u"))
        text = []
        for node in run:
            if node.tag == f"{W}t":
                text.append(node.text or "")
            elif node.tag == f"{W}tab":
                text.append("\t")
            elif node.tag in (f"{W}br", f"{W}cr"):
                text.append("\n")
        text = "".join(text)
        if not text:
            continue
        if runs and (runs[-1]["b"], runs[-1]["i"], runs[-1]["u"]) == style:
            runs[-1]["text"] += text
        else:
            runs.append({"text": text, "b": style[0], "i": style[1], "u": style[2]})
    return runs


def _kind(paragraph):
    props = paragraph.find(f"{W}pPr")
    if props is None:
        return "paragraph", None
    style = props.find(f"{W}pStyle")
    name = (style.get(f"{W}val", "") if style is not None else "").replace(" ", "").lower()
    if name in HEADINGS:
        return "heading", HEADINGS[name]
    if props.find(f"{W}numPr") is not None or name.startswith("listparagraph"):
        return "item", None
    return "paragraph", None


def _cell_text(cell):
    return "\n".join("".join(r["text"] for r in _runs(p)) for p in cell.iter(f"{W}p")).strip()


def preview_blocks(data):
    """Blocks for the viewer, or Unreadable."""
    try:
        with zipfile.ZipFile(io.BytesIO(data)) as archive:
            if archive.getinfo("word/document.xml").file_size > MAX_WORD_XML:
                raise Unreadable
            xml = archive.read("word/document.xml")
        # ElementTree never fetches outside files, and Python's expat refuses entity bombs.
        root = ElementTree.fromstring(xml)
    except (zipfile.BadZipFile, OSError, ValueError, KeyError, ElementTree.ParseError):
        raise Unreadable
    body = root.find(f"{W}body")
    if body is None:
        raise Unreadable

    blocks, used = [], 0
    for node in body:
        if len(blocks) >= MAX_BLOCKS or used >= MAX_CHARACTERS:
            blocks.append({"type": "more"})
            break
        if node.tag == f"{W}p":
            runs = _runs(node)
            if not any(r["text"].strip() for r in runs):
                continue
            kind, level = _kind(node)
            block = {"type": kind, "runs": runs}
            if level:
                block["level"] = level
            used += sum(len(r["text"]) for r in runs)
        elif node.tag == f"{W}tbl":
            rows = [[_cell_text(cell) for cell in row.findall(f"{W}tc")] for row in node.findall(f"{W}tr")]
            rows = [row for row in rows if any(row)]
            if not rows:
                continue
            block = {"type": "table", "rows": rows}
            used += sum(len(cell) for row in rows for cell in row)
        else:
            continue
        blocks.append(block)
    return blocks
