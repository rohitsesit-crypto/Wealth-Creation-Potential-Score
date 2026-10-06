/**
 * Minimal, dependency-light DOCX templating.
 *
 * The 27 report templates in `public/` are real Word files that contain three
 * placeholders inside the document body:
 *
 *   [NAME]                   -> participant's full name
 *   [XX]/100 - [WCPS LABEL]  -> e.g. "78/100 - Well Positioned"
 *
 * Because a DOCX is a ZIP of XML parts, we patch `word/document.xml` only,
 * which preserves 100% of the original styling, tables, headers and footers.
 */

import JSZip from "jszip";

const XML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
};

export function escapeXml(value: string): string {
  return value.replace(/[&<>]/g, (char) => XML_ESCAPES[char] ?? char);
}

/**
 * Replaces the first occurrence of `placeholder`, even when Word has split the
 * placeholder across several runs (`<w:t>` nodes), which happens often after a
 * template is edited by hand.
 */
function replacePlaceholder(xml: string, placeholder: string, value: string): string {
  // Fast path: the placeholder sits intact inside a single text node.
  const textNode = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/;
  const nodeMatch = textNode.exec(xml);
  if (nodeMatch && nodeMatch[1].includes(placeholder)) {
    return xml.replace(/(<w:t(?:\s[^>]*)?>)([\s\S]*?)(<\/w:t>)/, (_full, open, text, close) => {
      return open + text.replace(placeholder, escapeXml(value)) + close;
    });
  }

  // Slow path: rebuild the node map and splice the placeholder across nodes.
  const nodes: { start: number; end: number; text: string }[] = [];
  const re = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(xml)) !== null) {
    nodes.push({ start: match.index, end: match.index + match[0].length, text: match[1] });
  }

  let joined = "";
  const offsets: { nodeIndex: number; charIndex: number }[] = [];
  nodes.forEach((node, nodeIndex) => {
    for (let i = 0; i < node.text.length; i += 1) {
      offsets.push({ nodeIndex, charIndex: i });
      joined += node.text[i];
    }
  });

  const at = joined.indexOf(placeholder);
  if (at === -1) return xml;

  const first = offsets[at];
  const last = offsets[at + placeholder.length - 1];
  if (!first || !last) return xml;

  const updated = nodes.map((node, nodeIndex) => {
    if (nodeIndex < first.nodeIndex || nodeIndex > last.nodeIndex) return node.text;
    const keepFrom = nodeIndex === first.nodeIndex ? node.text.slice(0, first.charIndex) : "";
    const keepTo =
      nodeIndex === last.nodeIndex ? node.text.slice(last.charIndex + 1) : "";
    const inserted = nodeIndex === first.nodeIndex ? escapeXml(value) : "";
    return keepFrom + inserted + keepTo;
  });

  let result = "";
  let cursor = 0;
  nodes.forEach((node, nodeIndex) => {
    result += xml.slice(cursor, node.start);
    const open = /^<w:t(?:\s[^>]*)?>/.exec(xml.slice(node.start, node.end))?.[0] ?? "<w:t>";
    result += open + updated[nodeIndex] + "</w:t>";
    cursor = node.end;
  });
  result += xml.slice(cursor);
  return result;
}

export type ReportFill = {
  name: string;
  wcpsDisplay: string;
};

/** Fills the report template and returns the finished DOCX as a Buffer. */
export async function fillDocxTemplate(template: Buffer | Uint8Array, fill: ReportFill): Promise<Buffer> {
  const zip = await JSZip.loadAsync(template);
  const documentPart = zip.file("word/document.xml");
  if (!documentPart) throw new Error("Invalid report template: word/document.xml is missing.");

  let xml = await documentPart.async("string");
  xml = replacePlaceholder(xml, "[XX]/100 - [WCPS LABEL]", fill.wcpsDisplay);
  xml = replacePlaceholder(xml, "[WCPS LABEL]", fill.wcpsDisplay);
  xml = replacePlaceholder(xml, "[XX]", fill.wcpsDisplay);
  xml = replacePlaceholder(xml, "[NAME]", fill.name);

  zip.file("word/document.xml", xml);
  const out = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  return Buffer.from(out);
}

/** Turns "Priya A. Sharma" into "Priya_A_Sharma" for safe filenames. */
export function safeFileStem(name: string): string {
  const cleaned = name
    .normalize("NFKD")
    .replace(/[^\w\s.-]/g, "")
    .trim()
    .replace(/\s+/g, "_")
    .replace(/_{2,}/g, "_");
  return (cleaned || "Participant").slice(0, 60);
}
