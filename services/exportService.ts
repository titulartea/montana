/**
 * Export Service
 * Provides functions to export notes as HTML or all notes as ZIP.
 */

import { FileSystemNode, NodeType } from '../types';

/** Export a single note as HTML */
export function exportAsHTML(node: FileSystemNode): void {
  const content = node.content || '';
  // Simple markdown-to-html using basic regex patterns
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${escapeHtml(node.name)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 800px; margin: 40px auto; padding: 0 20px; line-height: 1.6; color: #333; }
    pre { background: #f5f5f5; padding: 12px; border-radius: 6px; overflow-x: auto; }
    code { background: #f5f5f5; padding: 2px 4px; border-radius: 3px; font-size: 0.9em; }
    blockquote { border-left: 3px solid #7c3aed; margin-left: 0; padding-left: 16px; color: #666; }
    img { max-width: 100%; height: auto; }
    h1 { border-bottom: 1px solid #eee; padding-bottom: 8px; }
  </style>
</head>
<body>
<article>
${markdownToSimpleHtml(content)}
</article>
</body>
</html>`;

  downloadFile(html, `${node.name}.html`, 'text/html');
}

/** Export all notes as a .zip (using a minimal zip builder) */
export async function exportAsZip(nodes: FileSystemNode[]): Promise<void> {
  const files = nodes.filter(n => n.type === NodeType.FILE);

  // Build path map for nice folder structure
  const pathMap = buildPathMap(nodes);

  // Use a simple in-browser zip approach
  const zipParts: { name: string; data: Uint8Array }[] = [];

  for (const file of files) {
    const path = pathMap.get(file.id) || `${file.name}.md`;
    const data = new TextEncoder().encode(file.content || '');
    zipParts.push({ name: path, data });
  }

  const zipBlob = createZip(zipParts);
  const url = URL.createObjectURL(zipBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'montana-export.zip';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ----- HELPERS -----

function buildPathMap(nodes: FileSystemNode[]): Map<string, string> {
  const map = new Map<string, string>();

  function getPath(id: string): string {
    const node = nodes.find(n => n.id === id);
    if (!node) return '';
    if (node.parentId === null) return node.name;
    return getPath(node.parentId) + '/' + node.name;
  }

  for (const node of nodes) {
    if (node.type === NodeType.FILE) {
      const path = getPath(node.id);
      const ext = path.endsWith('.md') || path.endsWith('.txt') ? '' : '.md';
      map.set(node.id, path + ext);
    }
  }

  return map;
}

function downloadFile(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Very basic markdown → HTML (for export only; the app uses react-markdown for rendering) */
function markdownToSimpleHtml(md: string): string {
  let html = escapeHtml(md);

  // Headers
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

  // Bold, italic, strikethrough
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/~~(.+?)~~/g, '<del>$1</del>');

  // Inline code
  html = html.replace(/`(.+?)`/g, '<code>$1</code>');

  // Blockquotes
  html = html.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');

  // Unordered lists
  html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>\n?)+/g, (m) => `<ul>${m}</ul>`);

  // Links
  html = html.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>');

  // Images (including base64)
  html = html.replace(/!\[(.+?)\]\((.+?)\)/g, '<img src="$2" alt="$1"/>');

  // Paragraphs (double newlines)
  html = html.replace(/\n\n/g, '</p><p>');
  html = `<p>${html}</p>`;
  html = html.replace(/<p>\s*<(h[1-3]|ul|blockquote)/g, '<$1');
  html = html.replace(/<\/(h[1-3]|ul|blockquote)>\s*<\/p>/g, '</$1>');

  return html;
}

// ----- MINIMAL ZIP BUILDER (no dependencies) -----

interface ZipEntry {
  name: string;
  data: Uint8Array;
}

function createZip(entries: ZipEntry[]): Blob {
  const parts: Uint8Array[] = [];
  const centralDir: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = new TextEncoder().encode(entry.name);
    const crc = crc32(entry.data);
    const size = entry.data.length;

    // Local file header
    const local = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true); // sig
    lv.setUint16(4, 20, true); // version needed
    lv.setUint16(6, 0, true); // flags
    lv.setUint16(8, 0, true); // compression: store
    lv.setUint16(10, 0, true); // mod time
    lv.setUint16(12, 0, true); // mod date
    lv.setUint32(14, crc, true);
    lv.setUint32(18, size, true); // compressed
    lv.setUint32(22, size, true); // uncompressed
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true); // extra length
    local.set(nameBytes, 30);

    parts.push(local);
    parts.push(entry.data);

    // Central directory entry
    const central = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, 0, true);
    cv.setUint16(14, 0, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, size, true);
    cv.setUint32(24, size, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint16(30, 0, true);
    cv.setUint16(32, 0, true);
    cv.setUint16(34, 0, true);
    cv.setUint16(36, 0, true);
    cv.setUint32(38, 0x20, true);
    cv.setUint32(42, offset, true);
    central.set(nameBytes, 46);
    centralDir.push(central);

    offset += local.length + entry.data.length;
  }

  const centralOffset = offset;
  let centralSize = 0;
  for (const cd of centralDir) {
    parts.push(cd);
    centralSize += cd.length;
  }

  // End of central directory
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(4, 0, true);
  ev.setUint16(6, 0, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, centralOffset, true);
  ev.setUint16(20, 0, true);
  parts.push(eocd);

  return new Blob(parts, { type: 'application/zip' });
}

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}
