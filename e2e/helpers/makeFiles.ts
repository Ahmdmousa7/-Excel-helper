/**
 * In-memory file builders for the upload suites.
 *
 * Buffers rather than committed fixtures: a 40,000-row spreadsheet in the repo
 * would dominate every diff and every clone, and the property under test is the
 * row count, not the bytes. Building them here also makes the size a parameter,
 * so a test can say what it means ("40k rows") instead of referencing
 * `large.xlsx` and hoping.
 *
 * `tests/fixtures/` holds the one deliberate exception — see its README. That
 * bug is about how Excel stores a value, so a file you can open in Excel earns
 * its bytes. `makeScientificNotationXlsx()` below builds the same content, so the
 * suites never depend on the binary alone.
 */

import * as XLSX from 'xlsx';

export type MadeFile = { name: string; mimeType: string; buffer: Buffer };

export const CSV_MIME = 'text/csv';
export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** A CSV with `rows` data rows and a stable, predictable shape. */
export function makeCsv(rows: number, name = `data-${rows}.csv`): MadeFile {
  const header = 'SKU,Name,Price,Qty,Category\n';
  const body: string[] = [];
  for (let i = 1; i <= rows; i++) {
    body.push(`SKU-${i},Product ${i},${(i % 500) + 0.99},${i % 97},Cat-${i % 12}`);
  }
  return {
    name,
    mimeType: CSV_MIME,
    buffer: Buffer.from(header + body.join('\n'), 'utf8'),
  };
}

/** A CSV whose cells contain the punctuation that breaks naive parsers. */
export function makeAwkwardCsv(name = 'awkward.csv'): MadeFile {
  const content = [
    'SKU,Name,Notes',
    '"SKU,001","Product ""quoted""","line one\nline two"',
    'SKU-002,Café — naïve,"semi;colon, and comma"',
    'SKU-003,=1+1,"@SUM(A1:A2)"', // formula-injection shapes
    'SKU-004,منتج عربي,"مع فاصلة، هنا"',
    'SKU-005,,',
  ].join('\n');
  return { name, mimeType: CSV_MIME, buffer: Buffer.from(content, 'utf8') };
}

/** Not a spreadsheet at all, whatever the extension claims. */
export function makeNotASpreadsheet(name = 'actually-text.xlsx'): MadeFile {
  return {
    name,
    mimeType: XLSX_MIME,
    buffer: Buffer.from('this is plain text pretending to be a workbook', 'utf8'),
  };
}

/** A file with a valid XLSX/ZIP magic number and complete garbage after it. */
export function makeCorruptXlsx(name = 'corrupt.xlsx'): MadeFile {
  const zipMagic = Buffer.from([0x50, 0x4b, 0x03, 0x04]); // "PK\x03\x04"
  const garbage = Buffer.alloc(2048);
  for (let i = 0; i < garbage.length; i++) garbage[i] = (i * 37) % 256;
  return { name, mimeType: XLSX_MIME, buffer: Buffer.concat([zipMagic, garbage]) };
}

export function makeEmptyFile(name = 'empty.csv'): MadeFile {
  return { name, mimeType: CSV_MIME, buffer: Buffer.alloc(0) };
}

/** A binary blob with an image extension, for the wrong-type-entirely case. */
export function makeFakeImage(name = 'photo.png'): MadeFile {
  const pngMagic = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return { name, mimeType: 'image/png', buffer: Buffer.concat([pngMagic, Buffer.alloc(512)]) };
}

/**
 * A workbook whose barcodes Excel displays in scientific notation (TD-038).
 *
 * Barcodes of 12+ digits stored as numbers, alongside the same digits stored as
 * text. Excel's General format switches to scientific at 12 digits, so the
 * number column arrives with `w` values like "1.23457E+12" while the text column
 * is exact — which makes the text column a built-in oracle for the number one.
 *
 * The same content is committed as `tests/fixtures/scientific-notation-barcodes.xlsx`
 * for the unit suite and for opening in Excel by hand. This builder exists so the
 * e2e suite can upload it without depending on that binary, and so the content is
 * defined once in a form that is reviewable in a diff.
 */
export function makeScientificNotationXlsx(name = 'scientific-barcodes.xlsx'): MadeFile {
  const rows: (string | number)[][] = [
    ['SKU', 'Barcode (stored as number)', 'Barcode (stored as text)', 'Price', 'Note'],
    ['COMP-001', 1234567890123, '1234567890123', 1234.5678, '13-digit EAN, the common case'],
    ['COMP-002', 1234567890123456, '1234567890123456', 5, '16-digit, display truncated to 6 sig figs'],
    ['COMP-003', 9876543210987, '9876543210987', 3.1, '13-digit'],
    ['COMP-004', 12345678901, '12345678901', 0.15, '11-digit: under the threshold, never broke'],
    ['000456', 1112223334445, '1112223334445', 9.99, 'leading-zero SKU kept as text'],
    ['AB-0012-X', 5556667778889, '5556667778889', 1.05, 'alphanumeric SKU'],
  ];

  const ws = XLSX.utils.aoa_to_sheet(rows);
  // Force the third column and the two odd SKUs to text. `aoa_to_sheet` would
  // otherwise store "1234567890123" as a number and the oracle column would be
  // subject to the very bug it exists to detect.
  for (let r = 2; r <= rows.length; r++) {
    ws[`C${r}`] = { t: 's', v: String(rows[r - 1][2]) };
  }
  ws.A6 = { t: 's', v: '000456' };
  ws.A7 = { t: 's', v: 'AB-0012-X' };

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Composite');
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([['SKU', 'Cost'], ['RAW-A', 10.5], ['RAW-B', 7.25]]),
    'Raw',
  );

  return {
    name,
    mimeType: XLSX_MIME,
    buffer: Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })),
  };
}
