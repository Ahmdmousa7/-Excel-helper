import * as XLSX from 'xlsx';

/**
 * Parse an uploaded file's bytes into a workbook, decoding CSV text correctly.
 * TD-050.
 *
 * SheetJS, handed raw bytes, decodes a CSV as Latin-1. A UTF-8 CSV WITHOUT a
 * byte-order mark — every Google Sheets export, and most tools other than
 * Excel — therefore came out as mojibake: `حوار بلدي` became a run of `Ø`/`Ù`
 * characters. English survived, which is why it went unnoticed; Arabic product
 * names, categories and descriptions did not.
 *
 * Its own module, deliberately, so the one component that loads it lazily
 * (SupportChat) pulls in SheetJS's reader and nothing else — not the styled
 * writer that lives alongside `readExcelFile` in excelService.
 *
 * The OCR template upload has its own UTF-8 path (`parseCsvTemplate`) and is
 * kept separate from this on purpose.
 */

/**
 * `.xlsx`, `.xlsb`, `.ods` are ZIP containers. The FULL 4-byte signatures, not
 * just `PK`: a CSV whose first header starts with "PK" — a primary-key column is
 * common — would otherwise be mistaken for a workbook. Local file header, then
 * the empty-archive and spanned-archive markers.
 */
const ZIP_MAGICS = [
  [0x50, 0x4b, 0x03, 0x04],
  [0x50, 0x4b, 0x05, 0x06],
  [0x50, 0x4b, 0x07, 0x08],
] as const;
/** Legacy `.xls` — an OLE compound document. */
const OLE_MAGIC = [0xd0, 0xcf, 0x11, 0xe0] as const;

const startsWith = (bytes: Uint8Array, sig: readonly number[]) => sig.every((b, i) => bytes[i] === b);

/**
 * Is this a binary spreadsheet container, whatever its name says?
 *
 * Checked BEFORE the extension, so an `.xlsx` renamed to `.csv` is still
 * parsed as a workbook rather than decoded as text and turned to garbage.
 */
export const isBinaryWorkbook = (bytes: Uint8Array): boolean =>
  ZIP_MAGICS.some((sig) => startsWith(bytes, sig)) || startsWith(bytes, OLE_MAGIC);

/** A delimited-text spreadsheet, by extension. */
export const isDelimitedTextName = (fileName: string): boolean => /\.(csv|tsv)$/i.test(fileName);

/**
 * Bytes to text: strict UTF-8 first, Windows-1256 as the fallback.
 *
 * - UTF-8 is tried in FATAL mode, so bytes that are not valid UTF-8 throw
 *   rather than silently becoming U+FFFD — the throw is the signal to fall back.
 * - Windows-1256 is the legacy Arabic code page that older Excel versions use
 *   for "CSV (Comma delimited)" on an Arabic Windows. Forcing UTF-8 on such a
 *   file would corrupt it just as badly as the original bug.
 * - A UTF-8 byte-order mark is consumed by the decoder, so it never reaches the
 *   first header.
 *
 * Known limit: a non-Arabic legacy CSV (Latin-1 French, say) that is not valid
 * UTF-8 is decoded as 1256. That code page keeps the common accented Latin
 * letters, so French survives; other scripts would not. No code path handled
 * those before either.
 */
export function decodeTextBytes(bytes: Uint8Array): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder('windows-1256').decode(bytes);
  }
}

/**
 * The workbook in `bytes`. A delimited-text file is decoded to a string first
 * and parsed as text; anything else is parsed as bytes, exactly as before.
 *
 * `opts` are passed through unchanged, so each caller keeps its own parsing
 * behaviour (`raw`, `cellNF`, `cellDates` …) — only the DECODING changes.
 */
export function readWorkbookBytes(
  bytes: Uint8Array,
  fileName: string,
  opts: XLSX.ParsingOptions = {},
): XLSX.WorkBook {
  if (!isBinaryWorkbook(bytes) && isDelimitedTextName(fileName)) {
    return XLSX.read(decodeTextBytes(bytes), { ...opts, type: 'string' });
  }
  return XLSX.read(bytes, { ...opts, type: 'array' });
}
