"""Small sermon files built in memory for the tests: Word, PDF and plain text."""
import io
import zipfile

CONTENT_TYPES = (
    '<?xml version="1.0" encoding="UTF-8"?>'
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
    '<Default Extension="xml" ContentType="application/xml"/></Types>'
)
W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"


def docx_bytes(paragraphs, *, extra_files=None):
    """A Word file with one paragraph per item. An item that is a list becomes
    several runs in one paragraph, as Word saves text with mixed formatting."""
    body = []
    for paragraph in paragraphs:
        runs = paragraph if isinstance(paragraph, list) else [paragraph]
        body.append("<w:p>" + "".join(f"<w:r><w:t xml:space=\"preserve\">{run}</w:t></w:r>" for run in runs) + "</w:p>")
    document = f'<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="{W}"><w:body>{"".join(body)}</w:body></w:document>'
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("[Content_Types].xml", CONTENT_TYPES)
        archive.writestr("word/document.xml", document)
        for name, data in (extra_files or {}).items():
            archive.writestr(name, data)
    return buffer.getvalue()


def pdf_bytes(lines):
    """A one-page PDF showing each line of text, or a page with no text at all
    (like a scanned page) when `lines` is empty."""
    def escaped(text):
        return text.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")

    commands = ["BT", "/F1 12 Tf", "72 720 Td", "14 TL"]
    for line in lines:
        commands.append(f"({escaped(line)}) Tj T*")
    commands.append("ET")
    stream = "\n".join(commands).encode("latin-1") if lines else b""

    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R "
        b"/Resources << /Font << /F1 5 0 R >> >> >>",
        b"<< /Length " + str(len(stream)).encode() + b" >>\nstream\n" + stream + b"\nendstream",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ]
    out = io.BytesIO()
    out.write(b"%PDF-1.4\n")
    offsets = []
    for number, body in enumerate(objects, start=1):
        offsets.append(out.tell())
        out.write(f"{number} 0 obj\n".encode() + body + b"\nendobj\n")
    xref = out.tell()
    out.write(f"xref\n0 {len(objects) + 1}\n0000000000 65535 f \n".encode())
    for offset in offsets:
        out.write(f"{offset:010d} 00000 n \n".encode())
    out.write(f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n".encode())
    return out.getvalue()
