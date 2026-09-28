import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import { readFileSync } from 'node:fs';
import { textInputKind, workbookToText, docxXmlToText, extractDocxText } from '../../utils/ocrTextInput';
import { readWorkbookBytes } from '../../services/workbookBytes';

const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
const doc = (body: string) => `<?xml version="1.0" encoding="UTF-8"?><w:document ${W}><w:body>${body}</w:body></w:document>`;
const p = (...runs: string[]) => `<w:p>${runs.map((t) => `<w:r><w:t xml:space="preserve">${t}</w:t></w:r>`).join('')}</w:p>`;
const cell = (t: string) => `<w:tc><w:tcPr/>${p(t)}</w:tc>`;
const row = (...cells: string[]) => `<w:tr>${cells.map(cell).join('')}</w:tr>`;

async function docxBytes(body: string): Promise<Uint8Array> {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>');
  zip.file('word/document.xml', doc(body));
  return zip.generateAsync({ type: 'uint8array' });
}

describe('textInputKind', () => {
  it.each([
    ['menu.xlsx', 'spreadsheet'], ['old.XLS', 'spreadsheet'], ['export.csv', 'spreadsheet'], ['tabs.tsv', 'spreadsheet'],
    ['price list.docx', 'docx'], ['ancient.doc', 'legacy-doc'],
    ['photo.jpg', null], ['scan.pdf', null],
  ])('%s → %s', (name, kind) => {
    expect(textInputKind(name)).toBe(kind);
  });
});

describe('workbookToText', () => {
  it('a single sheet becomes plain CSV', () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Item', 'Price'], ['شاي', 13]]), 'Menu');
    expect(workbookToText(XLSX, wb)).toBe('Item,Price\nشاي,13');
  });

  it('a comma inside a cell stays inside that cell', () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Item'], ['Tea, large']]), 'S');
    expect(workbookToText(XLSX, wb)).toBe('Item\n"Tea, large"');
  });

  it('several sheets are each headed by name; empty sheets are skipped', () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['A'], ['1']]), 'Drinks');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([]), 'Empty');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['B'], ['2']]), 'Food');
    expect(workbookToText(XLSX, wb)).toBe('Sheet: Drinks\nA\n1\n\nSheet: Food\nB\n2');
  });

  it('a BOM-less Arabic CSV arrives as Arabic, through the TD-050 reader', () => {
    const bytes = new Uint8Array(readFileSync(new URL('../fixtures/rewaa-simple-template.csv', import.meta.url)));
    expect(workbookToText(XLSX, readWorkbookBytes(bytes, 'template.csv'))).toContain('حوار بلدي الكيلو');
  });
});

describe('docxXmlToText', () => {
  it('each paragraph is a line', () => {
    expect(docxXmlToText(doc(p('Menu') + p('Tea 13 SAR')))).toBe('Menu\nTea 13 SAR');
  });

  it('runs within a paragraph are joined', () => {
    expect(docxXmlToText(doc(p('Te', 'a')))).toBe('Tea');
  });

  it('a TABLE keeps its columns: one line per row, cells separated by tabs', () => {
    const body = `<w:tbl>${row('Item', 'Price')}${row('شاي', '13')}${row('قهوة', '15')}</w:tbl>`;
    expect(docxXmlToText(doc(body))).toBe('Item\tPrice\nشاي\t13\nقهوة\t15');
  });

  it('a cell with two paragraphs stays one cell', () => {
    const body = `<w:tbl><w:tr><w:tc>${p('Iced')}${p('Tea')}</w:tc><w:tc>${p('9')}</w:tc></w:tr></w:tbl>`;
    expect(docxXmlToText(doc(body))).toBe('Iced Tea\t9');
  });

  it('keeps tabs and line breaks inside a paragraph', () => {
    const body = '<w:p><w:r><w:t>A</w:t><w:tab/><w:t>B</w:t><w:br/><w:t>C</w:t></w:r></w:p>';
    expect(docxXmlToText(doc(body))).toBe('A\tB\nC');
  });

  it('decodes XML entities, named and numeric', () => {
    expect(docxXmlToText(doc(p('Fish &amp; Chips &lt;L&gt; &#65;&#x42;')))).toBe('Fish & Chips <L> AB');
  });

  it('DROPS tracked-change deletions — a deleted price must not reach the model', () => {
    const body = '<w:p><w:r><w:t>Tea </w:t></w:r><w:del><w:r><w:delText>12</w:delText></w:r></w:del>'
      + '<w:ins><w:r><w:t>13</w:t></w:r></w:ins></w:p>';
    expect(docxXmlToText(doc(body))).toBe('Tea 13');
  });

  it('DROPS field instructions — raw HYPERLINK syntax is not document text', () => {
    const body = '<w:p><w:r><w:instrText> HYPERLINK "https://x.test" </w:instrText></w:r><w:r><w:t>Order here</w:t></w:r></w:p>';
    expect(docxXmlToText(doc(body))).toBe('Order here');
  });

  it('collapses runs of blank lines', () => {
    expect(docxXmlToText(doc(p('A') + '<w:p/><w:p/><w:p/>' + p('B')))).toBe('A\n\nB');
  });
});

describe('extractDocxText — a real .docx package', () => {
  it('reads word/document.xml out of the ZIP', async () => {
    const text = await extractDocxText(await docxBytes(p('قائمة الطعام') + `<w:tbl>${row('شاي', '13')}</w:tbl>`));
    expect(text).toBe('قائمة الطعام\nشاي\t13');
  });

  it('a file that is not a ZIP is rejected with a clear message', async () => {
    await expect(extractDocxText(new TextEncoder().encode('not a docx'))).rejects.toThrow(/not a valid \.docx/);
  });

  it('a ZIP without a document body is rejected with a clear message', async () => {
    const zip = new JSZip();
    zip.file('something.txt', 'x');
    await expect(extractDocxText(await zip.generateAsync({ type: 'uint8array' }))).rejects.toThrow(/word\/document\.xml is missing/);
  });
});
