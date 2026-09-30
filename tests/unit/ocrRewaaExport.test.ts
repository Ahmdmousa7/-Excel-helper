import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import { readFileSync } from 'node:fs';
import { writeWorkbookBuffer } from '../../services/excelService';
import {
  englishFirst, normalizeBilingual, inferSizeVariants, fillRandomSkus, resolveDuplicateNames,
  prepareRewaaBatch, buildRewaaExport, sheetsToWorkbook, buildBundle, autoExportDecision,
  safeStem, safeEntryName, exportBaseName, fileStamp, priceNumber, variantNameOf,
  SHEETS, REWAA_SIMPLE_HEADERS, REWAA_VARIABLE_HEADERS, type Row, type SourceInfo,
} from '../../utils/ocrRewaaExport';

/**
 * OCR → Rewaa, against the three files the product owner supplied on
 * 2026-09-30 (tests/fixtures/ocr-rewaa/README.md):
 *
 *   source.xlsx          what OCR was run on
 *   model-answer.json    what the model returned for it (Arabic first, the two
 *                        size pairs as plain Simple rows — as the live run did)
 *   correct-output.xlsx  THE CONTRACT
 *   wrong-output.xlsx    what the app produced before this module
 *
 * The regression test runs the answer through the real pipeline, writes the
 * workbook with the app's own writer, reads it back, and compares EVERY CELL
 * of every sheet with the contract. Random SKUs are compared by shape and by
 * agreement between sheets; three cells differ on purpose (see the module).
 */

const fx = (name: string) => readFileSync(new URL(`../fixtures/ocr-rewaa/${name}`, import.meta.url));
const SOURCE_NAME = 'kelah.yallaqrcodes.com_extract_1790703069069.xlsx';
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const EXTRACTED_AT = new Date('2026-09-29T18:15:08.000Z');
const answer = (): Row[] => JSON.parse(fx('model-answer.json').toString('utf8'));

/** Deterministic stand-in for Math.random, so a failing run can be replayed. */
const seeded = (seed = 42) => () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);

type Grid = unknown[][];
const grids = (buf: Uint8Array | Buffer): Record<string, Grid> => {
  const wb = XLSX.read(buf, { type: 'buffer' });
  return Object.fromEntries(wb.SheetNames.map((n) => [n, XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, defval: null, raw: true }) as Grid]));
};
const sheetOrder = (buf: Uint8Array | Buffer) => XLSX.read(buf, { type: 'buffer' }).SheetNames;
const cellTypes = (buf: Uint8Array | Buffer, sheet: string, header: string): string[] => {
  const ws = XLSX.read(buf, { type: 'buffer' }).Sheets[sheet];
  const range = XLSX.utils.decode_range(ws['!ref']!);
  let col = -1;
  for (let c = 0; c <= range.e.c; c++) if (ws[XLSX.utils.encode_cell({ r: 0, c })]?.v === header) col = c;
  const out: string[] = [];
  for (let r = 1; r <= range.e.r; r++) out.push(ws[XLSX.utils.encode_cell({ r, c: col })]?.t ?? 'blank');
  return out;
};

const sourceInfo = (): SourceInfo[] => [{ name: SOURCE_NAME, type: XLSX_MIME, size: fx('source.xlsx').length, status: 'Extracted' }];

/** The production pipeline end to end: batch → run-level names → sheets → bytes. */
function runPipeline(rows: Row[] = answer()) {
  const batch = prepareRewaaBatch(rows, { sourceFile: SOURCE_NAME, usedSkus: new Set(), randomSkus: true, rand: seeded() });
  const named = resolveDuplicateNames(batch.rows);
  const exported = buildRewaaExport(named.rows, sourceInfo(), EXTRACTED_AT);
  const bytes = new Uint8Array(writeWorkbookBuffer(sheetsToWorkbook(XLSX, exported.sheets)));
  return { batch, named, exported, bytes };
}

const GEN = /^GEN-\d{1,6}$/;
const isSkuHeader = (h: unknown) => /SKU/.test(String(h));

/**
 * Every cell of `actual` equals `expected`, except SKU cells (random → shape)
 * and the listed intentional deviations. Returns the mismatches rather than
 * asserting one by one, so a failure shows all of them at once.
 */
function diffGrid(sheet: string, actual: Grid, expected: Grid, deviations: Record<string, (row: unknown[], hdr: unknown[]) => unknown> = {}) {
  const out: string[] = [];
  expect(actual[0], `${sheet}: headers`).toEqual(expected[0]);
  if (actual.length !== expected.length) out.push(`${sheet}: ${actual.length - 1} rows, expected ${expected.length - 1}`);
  const hdr = expected[0];
  for (let r = 1; r < Math.min(actual.length, expected.length); r++) {
    hdr.forEach((h, c) => {
      const a = actual[r][c] ?? null;
      let e: unknown = expected[r][c] ?? null;
      if (String(h) in deviations) e = deviations[String(h)](expected[r], hdr);
      if (isSkuHeader(h) && typeof e === 'string' && e !== '') {
        if (typeof a !== 'string' || !GEN.test(a)) out.push(`${sheet} r${r + 1} ${h}: ${JSON.stringify(a)} is not a GEN SKU`);
      } else if (a !== e) {
        out.push(`${sheet} r${r + 1} ${h}: got ${JSON.stringify(a)}, expected ${JSON.stringify(e)}`);
      }
    });
  }
  return out;
}

describe('OCR → Rewaa regression: source → pipeline → CORRECT fixture, cell by cell', () => {
  const correct = grids(fx('correct-output.xlsx'));
  const { bytes, exported } = runPipeline();
  const got = grids(bytes);

  it('produces the same six sheets in the same order', () => {
    expect(sheetOrder(bytes)).toEqual(sheetOrder(fx('correct-output.xlsx')));
  });

  it('Generic All Data / Simple / Variable match every cell', () => {
    const mismatches = [SHEETS.all, SHEETS.simple, SHEETS.variable]
      .flatMap((s) => diffGrid(s, got[s], correct[s]));
    expect(mismatches).toEqual([]);
  });

  it('Rewaa Simple Products matches every cell', () => {
    expect(diffGrid(SHEETS.rewaaSimple, got[SHEETS.rewaaSimple], correct[SHEETS.rewaaSimple])).toEqual([]);
  });

  it('Rewaa Variable Products matches every cell — Option 1 carries the real option name (approved deviation)', () => {
    // The fixture writes the literal text "Option 1"; the approved behaviour is
    // the option name, which the Generic Variable sheet of the SAME fixture has.
    const genericOptionName = new Map(correct[SHEETS.variable].slice(1).map((r) => [r[9], r[5]])); // Variant Name → Option 1 Name
    const mismatches = diffGrid(SHEETS.rewaaVariable, got[SHEETS.rewaaVariable], correct[SHEETS.rewaaVariable], {
      'Option 1': (row) => genericOptionName.get(row[11]) ?? null,
    });
    expect(mismatches).toEqual([]);
    expect(correct[SHEETS.rewaaVariable].slice(1).every((r) => r[5] === 'Option 1'), 'fixture changed?').toBe(true);
  });

  it('Source Files & Audit matches, except the real file size and an honest note', () => {
    const mismatches = diffGrid(SHEETS.audit, got[SHEETS.audit], correct[SHEETS.audit], {
      'File Size': () => `${(fx('source.xlsx').length / 1024).toFixed(1)} KB`,
      'Verification Notes': () => 'Extracted successfully; 5 row(s) differ in the Rewaa sheets (see Rewaa Data Identical)',
    });
    expect(mismatches).toEqual([]);
  });

  it('the same SKU identifies a row on every sheet it appears on', () => {
    const all = got[SHEETS.all].slice(1);
    const simpleSkus = all.filter((r) => r[4] === 'Simple').map((r) => r[0]);
    const variantSkus = all.filter((r) => r[4] === 'Variable').map((r) => r[1]);
    expect(got[SHEETS.simple].slice(1).map((r) => r[0])).toEqual(simpleSkus);
    expect(got[SHEETS.rewaaSimple].slice(1).map((r) => r[1])).toEqual(simpleSkus);
    expect(got[SHEETS.variable].slice(1).map((r) => r[0])).toEqual(variantSkus);
    expect(got[SHEETS.rewaaVariable].slice(1).map((r) => r[12])).toEqual(variantSkus);
    const every = [...simpleSkus, ...variantSkus];
    expect(new Set(every).size).toBe(180); // unique
  });

  it('cell TYPES match the contract: text prices on Generic, numbers on Rewaa, booleans for flags', () => {
    for (const [sheet, header, type] of [
      [SHEETS.all, 'Retail Price', 's'], [SHEETS.rewaaSimple, 'Retail Price', 'n'], [SHEETS.rewaaVariable, 'Retail Price', 'n'],
      [SHEETS.all, 'Rewaa Data Identical', 'b'], [SHEETS.rewaaSimple, 'Product SKU', 's'], [SHEETS.rewaaVariable, 'Variant SKU', 's'],
    ] as const) {
      const expected = cellTypes(fx('correct-output.xlsx'), sheet, header);
      expect(cellTypes(bytes, sheet, header), `${sheet} / ${header}`).toEqual(expected);
      expect(expected.every((t) => t === type)).toBe(true); // a missing price is an empty TEXT cell
    }
  });

  it('counts: 180 rows, 115 simple, 65 variable, 5 missing prices, 5 not identical', () => {
    expect(exported.counts).toEqual({ total: 180, simple: 115, variable: 65, notIdentical: 5, missingPrice: 5 });
  });
});

describe('the WRONG output is caught', () => {
  const correct = grids(fx('correct-output.xlsx'));
  const wrong = grids(fx('wrong-output.xlsx'));

  it('the wrong file fails the same comparison, on structure and on values', () => {
    expect(sheetOrder(fx('wrong-output.xlsx'))).not.toEqual(sheetOrder(fx('correct-output.xlsx')));
    expect(wrong[SHEETS.all]).toBeUndefined();
    // Its data sheet vs the contract's: headers differ, and the names are Arabic-first.
    expect(wrong['All Extracted Data'][0]).not.toEqual(correct[SHEETS.all][0]);
    const wrongNames = wrong['All Extracted Data'].slice(1).map((r) => r[1]);
    const rightNames = correct[SHEETS.all].slice(1).map((r) => r[2]);
    expect(wrongNames.filter((n, i) => n === rightNames[i]).length).toBeLessThan(10);
  });

  it('the real model output from the wrong run, through the new pipeline, gets the contract shape', () => {
    // Rebuild the model's answer from the wrong file: drop the SKUs the old code
    // generated and the letters its name de-duplication added.
    const [hdr, ...body] = wrong['All Extracted Data'];
    const raw = body.map((r) => {
      const o: Row = Object.fromEntries(hdr.map((h, i) => [String(h), r[i] ?? '']));
      o['Product SKU'] = ''; o['Variant SKU'] = '';
      o['Product Name'] = String(o['Product Name']).replace(/ [A-Z]\d*$/, '');
      return o;
    });
    const { exported, bytes } = runPipeline(raw);
    const got = grids(bytes);
    expect(exported.counts).toMatchObject({ total: 180, simple: 115, variable: 65 });
    expect(got[SHEETS.all][0]).toEqual(correct[SHEETS.all][0]);
    const names = got[SHEETS.all].slice(1).map((r) => String(r[2]));
    expect(names.filter((n) => /^[A-Za-z]/.test(n))).toHaveLength(180); // English first, all of them
    // Row alignment with the contract: same type and price on every row.
    const pick = (g: Grid) => g.slice(1).map((r) => [r[4], r[9]]);
    expect(pick(got[SHEETS.all])).toEqual(pick(correct[SHEETS.all]));
  });
});

describe('englishFirst', () => {
  it.each([
    ['شاي أحمر | Red Tea', 'Red Tea | شاي أحمر'],
    ['Red Tea | شاي أحمر', 'Red Tea | شاي أحمر'],        // already right
    ['قهوة اليوم | Coffee of the Day', 'Coffee of the Day | قهوة اليوم'],
    ['كوكيز فانيليا \\ شوكلت | Vanilla / Chocolate Cookies', 'Vanilla / Chocolate Cookies | كوكيز فانيليا \\ شوكلت'],
    ['شاي', 'شاي'],                                      // one language: untouched
    ['بيبسي Pepsi | Pepsi', 'بيبسي Pepsi | Pepsi'],        // mixed first part: not guessed
    ['a | b | ج', 'a | b | ج'],                          // three parts: untouched
    ['برجر ٢ | Burger 2', 'Burger 2 | برجر ٢'],            // digits untouched, no conversion
  ])('%s → %s', (input, output) => expect(englishFirst(input)).toBe(output));

  it('leaves non-strings and fields outside the bilingual list alone', () => {
    expect(englishFirst(12)).toBe(12);
    const [r] = normalizeBilingual([{ 'Product Name': 'كرك | Karak', 'Product SKU': 'أ | B', 'Retail Price': '5.00' }]);
    expect(r).toEqual({ 'Product Name': 'Karak | كرك', 'Product SKU': 'أ | B', 'Retail Price': '5.00' });
  });
});

describe('inferSizeVariants', () => {
  const simple = (name: string, price: unknown, extra: Row = {}): Row =>
    ({ 'Product Name': name, Category: 'Waffle | الوافل', 'Retail Price': price, Type: 'Simple', ...extra });

  it('two prices for one name → Small (cheaper) and Large, in place, whatever the order', () => {
    const { rows, pairs } = inferSizeVariants([simple('A', '20.00'), simple('Other', '3'), simple('A', '14.00')]);
    expect(pairs).toBe(1);
    expect(rows.map((r) => [r.Type, r['Option 1'], r['Option 1 Value']])).toEqual([
      ['Variable', 'Size | الحجم', 'Large | كبير'],
      ['Simple', undefined, undefined],
      ['Variable', 'Size | الحجم', 'Small | صغير'],
    ]);
  });

  it('leaves alone: equal prices, a missing price, different categories, existing options, and groups of three', () => {
    const cases: Row[][] = [
      [simple('A', '5'), simple('A', '5')],
      [simple('A', '5'), simple('A', '')],
      [simple('A', '5'), simple('A', '7', { Category: 'Other' })],
      [simple('A', '5', { 'Option 1 Value': 'x' }), simple('A', '7')],
      [simple('A', '5'), simple('A', '7'), simple('A', '9')],
    ];
    for (const input of cases) {
      const { rows, pairs } = inferSizeVariants(input);
      expect(pairs).toBe(0);
      expect(rows.map((r) => r.Type)).toEqual(input.map(() => 'Simple'));
    }
    expect(inferSizeVariants(cases[4]).skipped).toBe(1);
  });

  it('a code read for the simple row becomes the variant code, leading zeros kept', () => {
    const { rows } = inferSizeVariants([simple('A', '5', { 'Product SKU': '00123' }), simple('A', '7', { 'Product SKU': '123' })]);
    expect(rows.map((r) => [r['Product SKU'], r['Variant SKU']])).toEqual([['', '00123'], ['', '123']]);
  });

  it('does not modify its input', () => {
    const input = [simple('A', '5'), simple('A', '7')];
    inferSizeVariants(input);
    expect(input[0].Type).toBe('Simple');
  });
});

describe('SKUs', () => {
  it('fills only blanks, by type, unique across the run; 00123 and 123 stay distinct text', () => {
    const used = new Set<string>();
    let n = 0;
    const collide = () => [0.5, 0.5, 0.25][n++ % 3]; // forces a repeat that must be skipped
    const rows = fillRandomSkus([
      { Type: 'Simple', 'Product SKU': '00123' }, { Type: 'Simple', 'Product SKU': '123' },
      { Type: 'Simple' }, { Type: 'Variable' },
    ], used, collide);
    expect(rows.map((r) => r['Product SKU'] ?? r['Variant SKU'])).toEqual(['00123', '123', 'GEN-500000', 'GEN-250000']);
    expect(rows[3]['Product SKU']).toBeUndefined();
  });

  it('leading zeros survive into the Rewaa sheets as TEXT', () => {
    const ex = buildRewaaExport([
      { 'Product Name': 'X', Type: 'Simple', 'Product SKU': '00123', 'Retail Price': '1', 'Source File': 's' },
      { 'Product Name': 'Y', Type: 'Variable', 'Variant SKU': '0045', 'Option 1': 'Size', 'Option 1 Value': 'S', 'Retail Price': '2', 'Source File': 's' },
    ], [], EXTRACTED_AT);
    const bytes = new Uint8Array(writeWorkbookBuffer(sheetsToWorkbook(XLSX, ex.sheets)));
    const g = grids(bytes);
    expect(g[SHEETS.rewaaSimple][1][1]).toBe('00123');
    expect(g[SHEETS.rewaaVariable][1][12]).toBe('0045');
    expect(cellTypes(bytes, SHEETS.rewaaSimple, 'Product SKU')).toEqual(['s']);
  });
});

describe('Rewaa sheet rules', () => {
  const build = (row: Row) => buildRewaaExport([{ 'Source File': 's', ...row }], [], EXTRACTED_AT);
  const rewaa = (row: Row, variable = false) => {
    const ex = build(row);
    const s = ex.sheets.find((x) => x.name === (variable ? SHEETS.rewaaVariable : SHEETS.rewaaSimple))!;
    return Object.fromEntries((s.rows[0] as string[]).map((h, i) => [h, s.rows[1][i]]));
  };

  it('column sets are exactly Rewaa\'s templates', () => {
    const header = (f: string) => readFileSync(new URL(`../fixtures/${f}`, import.meta.url), 'utf8').split(/\r?\n/)[0].split(',');
    expect([...REWAA_SIMPLE_HEADERS]).toEqual(header('rewaa-simple-template.csv'));
    expect([...REWAA_VARIABLE_HEADERS]).toEqual(header('rewaa-variable-template.csv'));
  });

  it('stock management is "no" even when the model said yes; Rewaa-only yes/no normalisation', () => {
    const r = rewaa({ 'Product Name': 'X', Type: 'Simple', 'Enable stock management': 'yes', Sellable: 'نعم', Weighted: 'TRUE', Purchasable: 'maybe', 'Retail Price': '3' });
    expect([r['Enable stock management'], r.Sellable, r.Weighted, r.Purchasable]).toEqual(['no', 'yes', 'yes', 'yes']);
    // The Generic sheet keeps what the model said, for traceability.
    const g = build({ 'Product Name': 'X', Type: 'Simple', 'Enable stock management': 'yes' }).sheets[0];
    expect(g.rows[1][(g.rows[0] as string[]).indexOf('Enable stock management')]).toBe('yes');
  });

  it('a missing price is 0 on Rewaa, blank on Generic, and the row is NOT identical', () => {
    const ex = build({ 'Product Name': 'X', Type: 'Simple', 'Retail Price': '' });
    const all = ex.sheets[0];
    const col = (h: string) => all.rows[1][(all.rows[0] as string[]).indexOf(h)];
    expect(col('Retail Price')).toBe('');
    expect([col('Same in Rewaa Simple'), col('Rewaa Data Identical')]).toEqual([false, false]);
    expect(rewaa({ 'Product Name': 'X', Type: 'Simple', 'Retail Price': '' })['Retail Price']).toBe(0);
  });

  it('prices: 4.00 → 4 and 12.50 → 12.5; unreadable text is kept rather than zeroed (no digit conversion)', () => {
    expect(priceNumber('4.00')).toBe(4);
    expect(priceNumber('12.50')).toBe(12.5);
    expect(priceNumber('٤')).toBeUndefined();
    expect(rewaa({ 'Product Name': 'X', Type: 'Simple', 'Retail Price': '٤٠' })['Retail Price']).toBe('٤٠');
  });

  it('Pack columns and Tax Code are blank; DEF Quantity, Cost and co. are 0', () => {
    const r = rewaa({ 'Product Name': 'X', Type: 'Simple', 'Retail Price': '3' });
    expect(Object.entries(r).filter(([h]) => h.startsWith('Pack')).every(([, v]) => v === '')).toBe(true);
    expect([r['Tax Code'], r['DEF Quantity'], r.Cost, r['Wholesale Price'], r['Buy Price']]).toEqual(['', 0, 0, 0, 0]);
  });

  it('Variant Name is built from name and option values, and blank when there is no option', () => {
    expect(variantNameOf({ 'Product Name': 'Red Tea | شاي أحمر', 'Option 1 Value': 'Cup | كوب' })).toBe('Red Tea | شاي أحمر | Cup | كوب');
    expect(variantNameOf({ 'Product Name': 'N', 'Option 1 Value': 'a', 'Option 2 Value': 'b' })).toBe('N | a | b');
    const r = rewaa({ 'Product Name': 'N', Type: 'Variable', 'Retail Price': '1' }, true);
    expect(r['Variant Name']).toBe('');
    expect(r['Option 1']).toBe('');
  });

  it('Arabic text is written byte for byte', () => {
    const name = 'كوكيز فانيليا \\ شوكلت | ١٢٣';
    expect(rewaa({ 'Product Name': name, Type: 'Simple', 'Retail Price': '1' })['Product Name']).toBe(name);
  });

  it('a column the model added is kept on Generic, empty optional columns are dropped', () => {
    const ex = build({ 'Product Name': 'X', Type: 'Simple', Calories: '120', 'Option 2': '', Description: '' });
    expect(ex.sheets[0].rows[0]).toContain('Calories');
    expect(ex.sheets[0].rows[0]).not.toContain('Option 2 Name');
    expect(ex.sheets[0].rows[0]).not.toContain('Description');
  });

  it('a run with no variable rows has no variable sheets', () => {
    expect(build({ 'Product Name': 'X', Type: 'Simple' }).sheets.map((s) => s.name))
      .toEqual([SHEETS.all, SHEETS.simple, SHEETS.rewaaSimple, SHEETS.audit]);
  });
});

describe('names, ZIP bundle, auto-export decision', () => {
  const at = new Date(2026, 8, 30, 14, 5, 3);

  it('file names are sanitised, Arabic kept', () => {
    expect(safeStem('../../etc/pa:ss*wd?.xlsx')).toBe('pa_ss_wd_');
    expect(safeStem('قائمة  المطعم.pdf')).toBe('قائمة المطعم');
    expect(safeStem('...')).toBe('ocr');
    expect(safeEntryName('C:\\x\\menu.PNG')).toBe('menu.png');
    expect(fileStamp(at)).toBe('20260930-140503');
    expect(exportBaseName(['menu.xlsx'], at)).toBe('OCR-Rewaa-menu-20260930-140503');
    expect(exportBaseName(['a.png', 'b.png', 'c.png'], at)).toBe('OCR-Rewaa-a-and-2-more-20260930-140503');
    expect(exportBaseName([], at)).toBe('OCR-Rewaa-pasted-text-20260930-140503');
  });

  it('the ZIP holds exactly: the workbook, each original file unchanged, summary.json — and no secret', async () => {
    const { exported, bytes } = runPipeline();
    const source = new Uint8Array(fx('source.xlsx'));
    const zipBytes = await buildBundle(JSZip, {
      baseName: 'OCR-Rewaa-x-20260930-140503', workbook: bytes, exported, extractedAt: EXTRACTED_AT,
      sourceInfo: sourceInfo(),
      sources: [{ name: SOURCE_NAME, data: source }, { name: SOURCE_NAME, data: source }],
    });
    const zip = await JSZip.loadAsync(zipBytes);
    const names = Object.keys(zip.files).filter((n) => !zip.files[n].dir).sort();
    expect(names).toEqual([
      'OCR-Rewaa-x-20260930-140503.xlsx',
      'source/kelah.yallaqrcodes.com_extract_1790703069069 (2).xlsx',
      'source/kelah.yallaqrcodes.com_extract_1790703069069.xlsx',
      'summary.json',
    ]);
    expect(Buffer.from(await zip.file(`source/${SOURCE_NAME}`)!.async('uint8array')).equals(Buffer.from(source))).toBe(true);
    expect(Buffer.from(await zip.file('OCR-Rewaa-x-20260930-140503.xlsx')!.async('uint8array')).equals(Buffer.from(bytes))).toBe(true);
    const summary = JSON.parse(await zip.file('summary.json')!.async('string'));
    expect(summary.counts).toEqual(exported.counts);
    expect(summary.rowsNeedingReview.map((r: { productName: string }) => r.productName)).toEqual([
      'Curry Meal | وجبة كاري', 'BBQ Meal | وجبة باربيكيو', 'Meatballs Meal | وجبة كرات اللحم', 'Basil Iced Tea | آيس تي حبق', 'Smoked Chicken | دجاج مدخن',
    ]);
    const everything = (await Promise.all(names.map((n) => zip.file(n)!.async('string')))).join('\n');
    expect(everything).not.toMatch(/AIza[0-9A-Za-z_-]{20,}|api[_-]?key|apiKey|token|Bearer /i);
  });

  it('the ZIP is deterministic for the same run', async () => {
    const { exported, bytes } = runPipeline();
    const make = () => buildBundle(JSZip, { baseName: 'b', workbook: bytes, exported, extractedAt: EXTRACTED_AT, sourceInfo: [], sources: [{ name: 'p.txt', data: 'hello' }] });
    expect(Buffer.from(await make()).equals(Buffer.from(await make()))).toBe(true);
  });

  it('downloads on its own only after a clean, successful run', () => {
    expect(autoExportDecision({ rows: 180, failedInputs: 0, built: true })).toBe('download');
    expect(autoExportDecision({ rows: 180, failedInputs: 1, built: true })).toBe('hold');   // partial failure
    expect(autoExportDecision({ rows: 0, failedInputs: 1, built: false })).toBe('none');    // OCR failed
    expect(autoExportDecision({ rows: 0, failedInputs: 0, built: false })).toBe('none');    // nothing extracted
    expect(autoExportDecision({ rows: 180, failedInputs: 0, built: false })).toBe('none');  // workbook failed
  });
});
