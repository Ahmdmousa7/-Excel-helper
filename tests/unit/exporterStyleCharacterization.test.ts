import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import XLSX_STYLE from 'xlsx-js-style';
import JSZip from 'jszip';

/**
 * CHARACTERIZATION of what survives each sheet builder, for TD-049.
 *
 * **No production code is changed by this file.**
 *
 * An earlier attempt at this question was inconclusive and that is the reason
 * this file exists. It asked `XLSX_STYLE.read(..., { cellStyles: true })`
 * whether a style came back, and got `false` for BOTH builders — including the
 * one that is in production today and demonstrably does support styles. A test
 * that reports failure for the known-good path is not measuring the thing it
 * claims to measure, and "inconclusive" is not an answer to build a decision on.
 *
 * So this file does not ask a library. It unzips the generated `.xlsx` and reads
 * the XML, which is what Excel reads:
 *
 *   - `xl/worksheets/sheet1.xml` — each `<c>` carries `s="N"`, an index into...
 *   - `xl/styles.xml` — `<cellXfs>`, whose Nth `<xf>` names a font, fill and
 *     numFmt by index. Chasing that chain is the only way to say "this cell is
 *     actually bold in the file".
 *
 * Every dimension below is paired with a **positive control**: the same probe
 * run against a sheet built WITHOUT the property, asserting the probe reports
 * absence. Without that pairing a probe that always returns `false` would look
 * like a clean pass. The controls are the point of this file.
 */

const SERIAL = 46037; // 2026-01-15
const DATE_FMT = 'yyyy-mm-dd';
const BOLD = { font: { bold: true } };
const FILL = { fill: { fgColor: { rgb: 'FFFF00' } } };

type Builder = (rows: unknown[][]) => any;
const buildStyled: Builder = (rows) => XLSX_STYLE.utils.aoa_to_sheet(rows as never);
const buildPlain: Builder = (rows) => XLSX.utils.aoa_to_sheet(rows as never);

/** Write a sheet through the styled writer, exactly as production does. */
function writeThroughStyledWriter(ws: any): ArrayBuffer {
  const wb = XLSX_STYLE.utils.book_new();
  XLSX_STYLE.utils.book_append_sheet(wb, ws, 'Out');
  return XLSX_STYLE.write(wb, { bookType: 'xlsx', type: 'array' });
}

/** The raw XML Excel would read. */
async function unzip(buf: ArrayBuffer) {
  const zip = await JSZip.loadAsync(buf);
  const grab = async (p: string) => {
    const f = zip.file(p);
    return f ? await f.async('string') : '';
  };
  return {
    sheet: await grab('xl/worksheets/sheet1.xml'),
    styles: await grab('xl/styles.xml'),
  };
}

/** `<c r="A1" s="3" .../>` → 3. Null when the cell carries no style index. */
function styleIndexOf(sheetXml: string, ref: string): number | null {
  const m = sheetXml.match(new RegExp(`<c[^>]*\\br="${ref}"[^>]*>`));
  if (!m) return null;
  const s = m[0].match(/\bs="(\d+)"/);
  return s ? Number(s[1]) : null;
}

/** The Nth `<xf>` inside `<cellXfs>`. */
function cellXfAt(stylesXml: string, idx: number): string | null {
  const block = stylesXml.match(/<cellXfs[^>]*>([\s\S]*?)<\/cellXfs>/);
  if (!block) return null;
  const xfs = block[1].match(/<xf\b[^>]*\/>|<xf\b[^>]*>[\s\S]*?<\/xf>/g) || [];
  return xfs[idx] ?? null;
}

/** Does the style record this cell points at use a bold font? */
function isBold(sheetXml: string, stylesXml: string, ref: string): boolean {
  const si = styleIndexOf(sheetXml, ref);
  if (si === null) return false;
  const xf = cellXfAt(stylesXml, si);
  if (!xf) return false;
  const fontId = Number(xf.match(/\bfontId="(\d+)"/)?.[1] ?? -1);
  if (fontId < 0) return false;
  const fonts = stylesXml.match(/<fonts[^>]*>([\s\S]*?)<\/fonts>/)?.[1] ?? '';
  const list = fonts.match(/<font\b[^>]*\/>|<font\b[^>]*>[\s\S]*?<\/font>/g) || [];
  const font = list[fontId] ?? '';
  return /<b\s*\/>|<b>/.test(font);
}

/** The number-format string this cell resolves to, if any. */
function numFmtOf(sheetXml: string, stylesXml: string, ref: string): string | null {
  const si = styleIndexOf(sheetXml, ref);
  if (si === null) return null;
  const xf = cellXfAt(stylesXml, si);
  if (!xf) return null;
  const id = Number(xf.match(/\bnumFmtId="(\d+)"/)?.[1] ?? -1);
  if (id <= 0) return null;
  const custom = stylesXml.match(
    new RegExp(`<numFmt[^>]*\\bnumFmtId="${id}"[^>]*\\bformatCode="([^"]*)"`),
  );
  return custom ? custom[1] : `builtin:${id}`;
}

/** `<cols><col width="…"/></cols>` — present at all? */
function hasColWidths(sheetXml: string): boolean {
  return /<cols>[\s\S]*?<col\b[^>]*\bwidth="/.test(sheetXml);
}

/** The raw `<c>` element, to inspect type and value. */
function cellOf(sheetXml: string, ref: string): string | null {
  return sheetXml.match(new RegExp(`<c[^>]*\\br="${ref}"[^>]*(?:/>|>[\\s\\S]*?</c>)`))?.[0] ?? null;
}

/** One fixture, built by whichever builder, with styles applied after the fact. */
function fixture(build: Builder, opts: { styled: boolean; widths: boolean }) {
  const ws = build([
    ['Header', 'When', 'Price'],
    ['A-1', SERIAL, 1200],
  ]);
  ws.B2.z = DATE_FMT;
  ws.C2.z = '#,##0.00';
  if (opts.styled) {
    ws.A1.s = { ...BOLD, ...FILL };
    ws.B1.s = BOLD;
    ws.C1.s = BOLD;
    ws.A2.s = FILL;
  }
  if (opts.widths) ws['!cols'] = [{ wch: 30 }, { wch: 14 }, { wch: 12 }];
  return ws;
}

async function facts(build: Builder, opts: { styled: boolean; widths: boolean }) {
  const { sheet, styles } = await unzip(writeThroughStyledWriter(fixture(build, opts)));
  return {
    headerBold: isBold(sheet, styles, 'A1'),
    headerBold2: isBold(sheet, styles, 'B1'),
    bodyStyled: styleIndexOf(sheet, 'A2') !== null,
    dateNumFmt: numFmtOf(sheet, styles, 'B2'),
    priceNumFmt: numFmtOf(sheet, styles, 'C2'),
    colWidths: hasColWidths(sheet),
    dateCell: cellOf(sheet, 'B2'),
    plainCell: cellOf(sheet, 'A2'),
  };
}

describe('TD-049 — the probe can actually detect a style regression (POSITIVE CONTROLS)', () => {
  /**
   * These four run FIRST and deliberately. If any fails, every result below is
   * meaningless and must not be used to justify a production change.
   */
  it('CONTROL: detects bold on the path that is in production today', async () => {
    const f = await facts(buildStyled, { styled: true, widths: true });
    expect(f.headerBold, 'the known-good path reports NO bold — the probe is broken').toBe(true);
  });

  it('CONTROL: reports NO bold when no style was applied — so it is not always-true', async () => {
    const f = await facts(buildStyled, { styled: false, widths: false });
    expect(f.headerBold).toBe(false);
  });

  it('CONTROL: detects column widths, and their absence', async () => {
    expect((await facts(buildStyled, { styled: true, widths: true })).colWidths).toBe(true);
    expect((await facts(buildStyled, { styled: true, widths: false })).colWidths).toBe(false);
  });

  it('CONTROL: detects a custom number format, and its absence', async () => {
    const withFmt = await facts(buildStyled, { styled: true, widths: true });
    expect(withFmt.dateNumFmt).toBe(DATE_FMT);
    const ws = buildStyled([['H'], [SERIAL]]); // no z applied
    const { sheet, styles } = await unzip(writeThroughStyledWriter(ws));
    expect(numFmtOf(sheet, styles, 'A2')).toBeNull();
  });
});

describe('TD-049 — does the plain builder lose anything the styled one keeps?', () => {
  it('cell styles survive the PLAIN builder identically', async () => {
    const styled = await facts(buildStyled, { styled: true, widths: true });
    const plain = await facts(buildPlain, { styled: true, widths: true });
    expect(plain.headerBold).toBe(styled.headerBold);
    expect(plain.headerBold2).toBe(styled.headerBold2);
    expect(plain.bodyStyled).toBe(styled.bodyStyled);
  });

  it('number formats survive the PLAIN builder identically', async () => {
    const styled = await facts(buildStyled, { styled: true, widths: true });
    const plain = await facts(buildPlain, { styled: true, widths: true });
    expect(plain.dateNumFmt).toBe(styled.dateNumFmt);
    expect(plain.priceNumFmt).toBe(styled.priceNumFmt);
  });

  it('column widths survive the PLAIN builder identically', async () => {
    const styled = await facts(buildStyled, { styled: true, widths: true });
    const plain = await facts(buildPlain, { styled: true, widths: true });
    expect(plain.colWidths).toBe(styled.colWidths);
  });

  it('a plain cell is written the same way by both builders', async () => {
    const styled = await facts(buildStyled, { styled: false, widths: false });
    const plain = await facts(buildPlain, { styled: false, widths: false });
    expect(plain.plainCell).toBe(styled.plainCell);
  });
});

describe('TD-049 — the date cell, which is the whole reason for the change', () => {
  /** A Date object is what `raw: true` hands an exporter; that is the input that breaks. */
  // LOCAL midnight, not `Date.UTC(...)`. This fixture was wrong at first and the
  // review caught it: a UTC-midnight Date is offset by the zone, so the test
  // failed at UTC-11 (46036.54) and UTC+14 (46037.58) — the exact class of bug
  // this work fixes, reproduced in the test meant to verify the fix.
  //
  // The app never produces such a Date: `sheet_to_json({ raw: true })` builds it
  // from the serial through LOCAL time, so it represents local midnight, which
  // round-trips exactly in any zone. `new Date(y, m, d)` matches that.
  const dateRows = () => [['When'], [new Date(2026, 0, 15)]];

  async function dateFacts(build: Builder) {
    const ws = build(dateRows());
    const { sheet, styles } = await unzip(writeThroughStyledWriter(ws));
    const back = XLSX.read(writeThroughStyledWriter(build(dateRows())), {
      type: 'array', cellNF: true,
    }).Sheets.Out.A2;
    return { xml: cellOf(sheet, 'A2'), numFmt: numFmtOf(sheet, styles, 'A2'), v: back.v, w: back.w };
  }

  it('CHARACTERIZATION: both builders emit a numeric date cell with a format', async () => {
    const styled = await dateFacts(buildStyled);
    const plain = await dateFacts(buildPlain);
    expect(styled.numFmt).toBeTruthy();
    expect(plain.numFmt).toBeTruthy();
    // Same format on both — the plain builder does not drop the date format.
    expect(plain.numFmt).toBe(styled.numFmt);
  });

  it('the PLAIN builder writes the exact serial, in EVERY timezone', async () => {
    // Verified under UTC, Pacific/Midway (-11) and Pacific/Kiritimati (+14),
    // rather than asserted. The earlier version of this test claimed to be
    // "TZ-independent by construction" and was not — it was only ever run in UTC.
    expect((await dateFacts(buildPlain)).v).toBe(SERIAL);
  });
});
