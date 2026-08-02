/**
 * In-memory file builders for the upload suites.
 *
 * Buffers rather than committed fixtures: a 40,000-row spreadsheet in the repo
 * would dominate every diff and every clone, and the property under test is the
 * row count, not the bytes. Building them here also makes the size a parameter,
 * so a test can say what it means ("40k rows") instead of referencing
 * `large.xlsx` and hoping.
 */

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
