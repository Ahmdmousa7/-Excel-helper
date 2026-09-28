import type * as XLSXNS from 'xlsx';
import JSZip from 'jszip';

/**
 * Turning a spreadsheet or a Word document into text for OCR Extraction.
 *
 * These formats join the SAME pipeline as images and PDFs: their text is sent
 * to the same structured-extraction call as the tab's text mode, with the same
 * prompt, so translation, variant splitting, random SKUs, template mapping and
 * the audit columns all apply unchanged. There is no second extraction system.
 *
 * Pure apart from JSZip; SheetJS is passed in, as elsewhere in `utils/`.
 */

export type TextInputKind = 'spreadsheet' | 'docx';

/**
 * Which kind of text input a file is, by extension.
 *
 * `legacy-doc` is reported separately so the tab can say so plainly: a `.doc`
 * is a binary OLE format with no text layer this app can read, and treating it
 * as an image would send the model an unreadable blob.
 */
export function textInputKind(fileName: string): TextInputKind | 'legacy-doc' | null {
  if (/\.(xlsx|xls|csv|tsv)$/i.test(fileName)) return 'spreadsheet';
  if (/\.docx$/i.test(fileName)) return 'docx';
  if (/\.doc$/i.test(fileName)) return 'legacy-doc';
  return null;
}

/**
 * Every non-empty sheet as CSV. SheetJS's CSV writer quotes commas, quotes and
 * newlines inside cells, so a product name containing a comma stays one cell.
 * With several sheets, each is headed by its name so the model can tell them
 * apart.
 */
export function workbookToText(lib: typeof XLSXNS, wb: XLSXNS.WorkBook): string {
  const blocks = wb.SheetNames.map((name) => {
    const csv = lib.utils.sheet_to_csv(wb.Sheets[name], { blankrows: false }).trim();
    if (!csv) return '';
    return wb.SheetNames.length > 1 ? `Sheet: ${name}\n${csv}` : csv;
  });
  return blocks.filter(Boolean).join('\n\n');
}

const ENTITIES: Readonly<Record<string, string>> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

const decodeEntities = (s: string): string =>
  s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, body: string) => {
    if (body[0] === '#') {
      const cp = body[1].toLowerCase() === 'x' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return Number.isFinite(cp) ? String.fromCodePoint(cp) : whole;
    }
    return ENTITIES[body.toLowerCase()] ?? whole;
  });

/**
 * The text of a Word body (`word/document.xml`), keeping its STRUCTURE:
 *   - each paragraph is a line;
 *   - a table row is a line, its cells separated by tabs — so a price list laid
 *     out as a Word table reaches the model as columns, not a run of words;
 *   - tabs and line breaks inside a paragraph are kept.
 *
 * Images, text boxes' layout and formatting are not text and are dropped.
 */
export function docxXmlToText(xml: string): string {
  let s = xml
    // Text that is in the file but NOT in the visible document: tracked-change
    // deletions, and field instructions such as `HYPERLINK "https://…"`. A plain
    // tag-strip would hand the model a deleted price or raw link syntax.
    .replace(/<w:delText\b[^>]*>[\s\S]*?<\/w:delText>/g, '')
    .replace(/<w:instrText\b[^>]*>[\s\S]*?<\/w:instrText>/g, '')
    // A cell is flattened to ONE trimmed line — its paragraphs, tabs and breaks
    // become single spaces, since a tab inside a cell would split the column —
    // and then ends with a tab.
    .replace(/<w:tc\b[^>]*>([\s\S]*?)<\/w:tc>/g, (_m, inner: string) => {
      const text = inner
        .replace(/<\/w:p>|<w:tab\s*\/>|<w:(?:br|cr)\b[^>]*\/>/g, ' ')
        .replace(/<[^>]+>/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      return `${text}\t`;
    })
    .replace(/<\/w:tr>/g, '\n')
    .replace(/<w:tab\s*\/>/g, '\t')
    .replace(/<w:(br|cr)\b[^>]*\/>/g, '\n')
    // An empty paragraph is written self-closing, `<w:p/>` — a blank line in
    // Word, and it separates sections. Without this it vanished entirely.
    .replace(/<w:p\b[^>]*\/>/g, '\n')
    .replace(/<\/w:p>/g, '\n')
    .replace(/<[^>]+>/g, '');
  s = decodeEntities(s);
  return s
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/, '').replace(/ {2,}/g, ' '))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** The text of a `.docx`, or an explanatory error if it is not one. */
export async function extractDocxText(bytes: Uint8Array): Promise<string> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(bytes);
  } catch {
    throw new Error('This file is not a valid .docx (it is not a ZIP package).');
  }
  const body = zip.file('word/document.xml');
  if (!body) throw new Error('This .docx has no document body (word/document.xml is missing).');
  return docxXmlToText(await body.async('string'));
}
