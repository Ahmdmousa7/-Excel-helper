import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { readFileSync } from 'node:fs';
import {
  planReadyToUpload, buildSimpleUpload, buildCompositeUpload, rawSkuIndex, checkSimpleUpload, checkCompositeUpload,
  mappingAuditRows, checkSheetRows, readySummary, MAX_INGREDIENTS, type SourceRow, type UploadCell,
} from '../../utils/readyToUpload';
import {
  SIMPLE_UPLOAD_HEADERS, SIMPLE_UPLOAD_SPEC_ROW, COMPOSITE_UPLOAD_HEADERS, COMPOSITE_UPLOAD_SPEC_ROW, UPLOAD_SHEET_NAME,
} from '../../utils/rewaaUploadTemplates';

/**
 * Ready to upload: Raw sheet → Rewaa Simple template, valid composites →
 * Rewaa Composite template, and the Identical check that re-reads them.
 */

// The product owner's templates, as supplied (no data in them).
const template = (f: string) => {
  const wb = XLSX.read(readFileSync(new URL(`../fixtures/ready-to-upload/${f}`, import.meta.url)), { type: 'buffer' });
  return { name: wb.SheetNames[0], rows: XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' }) as string[][] };
};

// The real Arabic headers (نموذج منتج مجمع.xlsx), ingredient columns extended to 30 with the template's own wording.
const RAW_AR = ['اسم المادة الخام + اسم الوحدة المستخدمة', 'الرقم التعريفي للمنتج (SKU)', 'سعر التكلفة غير شامل الضريبة للوحدة الواحدة', 'الكمية حسب الوحدة المستخدمة', 'الفئة', 'الضريبة'];
const ingHeaders = (n: number) => [
  // The real file's spacing is irregular ("رقم 3مطابق", "المادة4"): both kinds are here.
  n % 2 ? `الرمز التعريفي للمادة الخام رقم ${n} مطابق لرمز المرفوع علي النظام` : `الرمز التعريفي للمادة الخام رقم${n}مطابق لرمز المرفوع علي النظام`,
  n % 3 ? `مقدار الاستخدام من المادة ${n}` : `مقدار الاستخدام من المادة${n}`,
];
const COMP_AR = ['اسم المنتج المجمع', 'رمز المنتج المجمع', 'فئة المنتج', 'سعر البيع', ...Array.from({ length: 30 }, (_, i) => ingHeaders(i + 1)).flat()];

/** A source row with the same cells as text and value (the common case). */
const src = (cells: unknown[], sourceRow: number, value?: unknown[]): SourceRow => ({
  text: cells.map((c) => (c === null || c === undefined ? '' : String(c))), value: value ?? cells, sourceRow,
});
/** A composite row: name, sku, category, retail, then ingredient (sku, rate) for slots 1..30 (null = empty). */
const comp = (name: string, sku: string, cat: string, retail: unknown, slots: Record<number, [string, number]>, n: number) => {
  const cells: unknown[] = [name, sku, cat, retail];
  for (let i = 1; i <= 30; i++) cells.push(slots[i]?.[0] ?? '', slots[i]?.[1] ?? '');
  return src(cells, n);
};

const RAW_ROWS = [
  src(['زيت دوار الشمس ', '843258536022', 6.05, 24, 'خام ', ''], 2),
  src(['سكر سعودي ناعم', '844429818874', 2.1, 65, 'خام', ''], 3),
  src(['Sauce', '00123', 0.5, 10, 'خام', ''], 4),
  src(['Mint', `RAW-9${String.fromCharCode(0x200b)}`, 1, 5, 'خام', ''], 5),
  src(['', '', '', '', 'خام', ''], 6),            // a pre-filled template line: skipped
  src(['Last', 'RAW-30', 3, 1, 'خام', ''], 7),
];
const COMP_ROWS = [
  comp('Cake', 'C-1', 'Cakes', 230, { 1: ['843258536022', 0.5], 2: ['844429818874', 0.7] }, 2),
  // Slot 1 empty, 2 and 3 used: nothing moves up.
  comp('Gap', 'C-2', 'Cakes', 100, { 2: ['00123', 0.5], 3: ['843258536022', 1] }, 3),
  // Every slot, Product30 included; slot 9 written with an invisible character.
  comp('Full', 'C-3', 'Cakes', 999, Object.fromEntries(Array.from({ length: 30 }, (_, i) => [i + 1, [i === 8 ? 'RAW-9' : i === 29 ? 'RAW-30' : '843258536022', i + 1]])), 4),
];

function build(raw = RAW_ROWS, composites = COMP_ROWS) {
  const plan = planReadyToUpload(RAW_AR, COMP_AR);
  const simple = buildSimpleUpload(raw, plan);
  const index = rawSkuIndex(simple);
  const composite = buildCompositeUpload(composites, plan, index);
  const keys = new Set(index.keys());
  return { plan, simple, composite, keys };
}
const col = (h: string) => COMPOSITE_UPLOAD_HEADERS.indexOf(h as never);
const scol = (h: string) => SIMPLE_UPLOAD_HEADERS.indexOf(h as never);

describe('the templates', () => {
  it('19-20. header names and order are exactly the supplied templates (and their spec rows)', () => {
    const s = template('simple-template.xlsx');
    const c = template('composite-template.xlsx');
    expect([...SIMPLE_UPLOAD_HEADERS]).toEqual(s.rows[0]);
    expect([...SIMPLE_UPLOAD_SPEC_ROW]).toEqual(s.rows[1]);
    expect([...COMPOSITE_UPLOAD_HEADERS]).toEqual(c.rows[0]);
    expect([...COMPOSITE_UPLOAD_SPEC_ROW]).toEqual(c.rows[1]);
    expect([s.name, c.name]).toEqual([UPLOAD_SHEET_NAME, UPLOAD_SHEET_NAME]);
    expect(SIMPLE_UPLOAD_HEADERS).toHaveLength(45);
    expect(COMPOSITE_UPLOAD_HEADERS).toHaveLength(73);
  });

  it('every built file starts with exactly those two rows', () => {
    const { simple, composite } = build();
    expect(simple.rows.slice(0, 2)).toEqual([[...SIMPLE_UPLOAD_HEADERS], [...SIMPLE_UPLOAD_SPEC_ROW]]);
    expect(composite.rows.slice(0, 2)).toEqual([[...COMPOSITE_UPLOAD_HEADERS], [...COMPOSITE_UPLOAD_SPEC_ROW]]);
  });
});

describe('the plan: columns by header', () => {
  it('1-2. Arabic Raw headers → Product Name, Product SKU, Cost, DEF Quantity, Category', () => {
    const { plan } = build();
    expect(plan.raw.map((p) => [p.output, p.header, p.status])).toEqual([
      ['Product Name', 'اسم المادة الخام + اسم الوحدة المستخدمة', 'found'],
      ['Product SKU', 'الرقم التعريفي للمنتج (SKU)', 'found'],
      ['Cost', 'سعر التكلفة غير شامل الضريبة للوحدة الواحدة', 'found'],
      ['DEF Quantity', 'الكمية حسب الوحدة المستخدمة', 'found'],
      ['Category', 'الفئة', 'found'],
    ]);
    expect(plan.problems).toEqual([]);
  });

  it('3. English Raw headers, any order', () => {
    const plan = planReadyToUpload(['Category', 'Cost', 'Product SKU', 'Quantity', 'Product Name'], COMP_AR);
    expect(plan.raw.map((p) => [p.output, p.col])).toEqual([['Product Name', 4], ['Product SKU', 2], ['Cost', 1], ['DEF Quantity', 3], ['Category', 0]]);
  });

  it('4-5. Composite headers, Arabic and English', () => {
    expect(build().plan.composite.map((p) => [p.output, p.header])).toEqual([
      ['Product Name', 'اسم المنتج المجمع'], ['Product SKU', 'رمز المنتج المجمع'], ['Category', 'فئة المنتج'], ['Retail Price', 'سعر البيع'],
    ]);
    const en = planReadyToUpload(RAW_AR, ['Product Name', 'Product SKU', 'Category', 'Retail Price', 'Product1 SKU', 'Product1 Rate']);
    expect(en.composite.map((p) => p.col)).toEqual([0, 1, 2, 3]);
    expect(en.ingredients[0]).toMatchObject({ n: 1, skuCol: 4, rateCol: 5 });
  });

  it('6-8, 18. all 30 numbered pairs, irregular spacing included, each to its own ProductN', () => {
    const { plan } = build();
    expect(plan.ingredients).toHaveLength(MAX_INGREDIENTS);
    plan.ingredients.forEach((ing, i) => {
      expect(ing.n).toBe(i + 1);
      expect(ing.skuCol).toBe(4 + i * 2);
      expect(ing.rateCol).toBe(5 + i * 2);
    });
  });

  it('a manual dropdown choice wins over the header match', () => {
    const plan = planReadyToUpload(['SKU', 'Cost', 'New Cost', 'Name'], COMP_AR, { raw: { cost: { col: 2, type: 'manual' } } });
    expect(plan.raw.find((p) => p.key === 'cost')).toMatchObject({ col: 2, header: 'New Cost', type: 'manual' });
  });

  it('missing optional columns are left blank; a missing required one or an ambiguous one STOPS the build', () => {
    const noCost = planReadyToUpload(['SKU', 'Name'], COMP_AR);
    expect(noCost.problems).toEqual([]);
    expect(noCost.raw.find((p) => p.key === 'cost')!.status).toBe('missing');
    expect(planReadyToUpload(['Name', 'Cost'], COMP_AR).problems).toEqual([expect.stringContaining('no column for "Product SKU"')]);
    expect(planReadyToUpload(['SKU', 'sku', 'Name'], COMP_AR).problems).toEqual([expect.stringContaining('more than one column could be "Product SKU"')]);
    expect(planReadyToUpload(RAW_AR, ['Name', 'SKU', 'Cat', 'Unit', 'Ing SKU 1', 'Qty 1']).problems)
      .toEqual(expect.arrayContaining([expect.stringContaining('no numbered ingredient columns were recognised')]));
    expect(planReadyToUpload(RAW_AR, ['Product Name', 'Product SKU', 'Product31 SKU', 'Product31 Rate']).problems)
      .toEqual(expect.arrayContaining([expect.stringContaining('ingredient 31 has no place')]));
    expect(planReadyToUpload(RAW_AR, ['Product Name', 'Product SKU', 'Product1 SKU']).problems)
      .toEqual(expect.arrayContaining([expect.stringContaining('ingredient 1 has a SKU column but no usage column')]));
  });
});

describe('the Simple upload', () => {
  it('1. raw rows mapped by header; numbers as numbers; SKUs as text; template lines skipped', () => {
    const { simple } = build();
    expect(simple.skipped).toBe(1);
    expect(simple.rows).toHaveLength(2 + 5);
    const row = simple.rows[2];
    expect(row[scol('Product Name')]).toBe('زيت دوار الشمس');
    expect(row[scol('Product SKU')]).toBe('843258536022');
    expect(row[scol('Cost')]).toBe(6.05);
    expect(row[scol('DEF Quantity')]).toBe(24);
    expect(row[scol('Category')]).toBe('خام');
    // Every other column is empty: nothing is invented.
    expect(row.filter((v, c) => v !== null && !['Product Name', 'Product SKU', 'Cost', 'DEF Quantity', 'Category'].includes(SIMPLE_UPLOAD_HEADERS[c]))).toEqual([]);
  });

  it('13. leading zeros are kept', () => {
    expect(build().simple.rows[4][scol('Product SKU')]).toBe('00123');
  });

  it('a SKU stored as a number with a decimal format is its digits, not the display (real file: 846550779892 shown "846550779892.00")', () => {
    const { plan } = build();
    const s = buildSimpleUpload([{ text: ['Chicken', '846550779892.00', '18.5', '10', 'خام'], value: ['Chicken', 846550779892, 18.5, 10, 'خام'], sourceRow: 85 }], plan);
    expect(s.rows[2][scol('Product SKU')]).toBe('846550779892');
    // A zero-padded number format IS the code the user sees.
    const z = buildSimpleUpload([{ text: ['Pad', '00123', '1', '1', 'خام'], value: ['Pad', 123, 1, 1, 'خام'], sourceRow: 2 }], plan);
    expect(z.rows[2][scol('Product SKU')]).toBe('00123');
  });

  it('15-16. missing Cost and Quantity stay blank, never 0; unreadable numbers stay as text and fail the check', () => {
    const { plan } = build();
    const s = buildSimpleUpload([src(['A', 'X-1', '', '', 'خام'], 2), src(['B', 'X-2', 'abc', '5', 'خام'], 3)], plan);
    expect(s.rows[2][scol('Cost')]).toBeNull();
    expect(s.rows[2][scol('DEF Quantity')]).toBeNull();
    expect(s.rows[3][scol('Cost')]).toBe('abc');
    const check = checkSimpleUpload(s.rows, s.sources, plan);
    expect(check.rows[0].identical).toBe('yes');
    expect(check.rows[1]).toMatchObject({ identical: 'no', differences: ["Cost 'abc' is not a number"] });
  });
});

describe('the Composite upload', () => {
  it('normal row: name, SKU, category, retail price, ingredients 1 and 2', () => {
    const r = build().composite.rows[2];
    expect([r[col('Product Name')], r[col('Product SKU')], r[col('Category')], r[col('Retail Price')]]).toEqual(['Cake', 'C-1', 'Cakes', 230]);
    expect([r[col('Product1 SKU')], r[col('Product1 Rate')], r[col('Product2 SKU')], r[col('Product2 Rate')]]).toEqual(['843258536022', 0.5, '844429818874', 0.7]);
    expect(r[col('Product3 SKU')]).toBeNull();
  });

  it('9-10, 19. an empty slot stays empty: ingredient 2 is Product2, never moved to Product1', () => {
    const r = build().composite.rows[3];
    expect(r[col('Product1 SKU')]).toBeNull();
    expect(r[col('Product1 Rate')]).toBeNull();
    expect([r[col('Product2 SKU')], r[col('Product2 Rate')]]).toEqual(['00123', 0.5]);
    expect([r[col('Product3 SKU')], r[col('Product3 Rate')]]).toEqual(['843258536022', 1]);
  });

  it('8, 18. all 30 pairs, Product30 included, each with its own rate', () => {
    const r = build().composite.rows[4];
    for (let n = 1; n <= 30; n++) expect(r[col(`Product${n} Rate`)]).toBe(n);
    expect(r[col('Product30 SKU')]).toBe('RAW-30');
  });

  it('11-12. ingredient SKUs match the raw materials by identifierKey and are written as the Raw sheet spells them', () => {
    const { composite } = build();
    // Raw has "RAW-9" + a zero-width space; the composite wrote plain "RAW-9".
    expect(composite.rows[4][col('Product9 SKU')]).toBe(`RAW-9${String.fromCharCode(0x200b)}`);
  });

  it('14, 17. a missing raw material and a missing retail price: blanks, nothing invented, and flagged', () => {
    const { plan, simple, keys } = build();
    const index = rawSkuIndex(simple);
    const c = buildCompositeUpload([comp('Odd', 'C-9', '', '', { 1: ['NOPE', 2] }, 9)], plan, index);
    const r = c.rows[2];
    expect([r[col('Category')], r[col('Retail Price')], r[col('Product1 SKU')], r[col('Product1 Rate')]]).toEqual([null, null, 'NOPE', 2]);
    const check = checkCompositeUpload(c.rows, c.sources, plan, keys);
    expect(check.rows[0]).toMatchObject({ identical: 'no', differences: ["Product1 SKU 'NOPE' is not a raw material in the Simple upload"] });
  });
});

describe('Identical', () => {
  it('21. correct output: every row yes, structure clean', () => {
    const { plan, simple, composite, keys } = build();
    const s = checkSimpleUpload(simple.rows, simple.sources, plan);
    const c = checkCompositeUpload(composite.rows, composite.sources, plan, keys);
    expect([s.structure, c.structure]).toEqual([[], []]);
    expect(s.rows.map((r) => r.identical)).toEqual(['yes', 'yes', 'yes', 'yes', 'yes']);
    expect(c.rows.map((r) => r.identical)).toEqual(['yes', 'yes', 'yes']);
  });

  /** A copy of the built rows with one cell changed. */
  const corrupt = (rows: UploadCell[][], r: number, c: number, v: UploadCell) => rows.map((row, i) => (i === r ? row.map((x, j) => (j === c ? v : x)) : row));

  // 18 (the request's list) / 22-26: one field at a time.
  const SIMPLE_CASES: [string, UploadCell][] = [
    ['Product Name', 'Changed name'], ['Product SKU', 'RM-999'], ['Cost', 6.5], ['DEF Quantity', 25], ['Category', 'Other'],
  ];
  it.each(SIMPLE_CASES)('Simple: %s changed → no, and the difference names it', (field, bad) => {
    const { plan, simple } = build();
    const check = checkSimpleUpload(corrupt(simple.rows, 2, scol(field), bad), simple.sources, plan);
    expect(check.rows[0].identical).toBe('no');
    expect(check.rows[0].differences[0]).toMatch(new RegExp(`^${field} mismatch: expected .*, found '${bad}'$`));
    expect(check.rows.slice(1).every((r) => r.identical === 'yes')).toBe(true);
  });

  const COMPOSITE_CASES: [string, number, UploadCell][] = [
    ['Product Name', 2, 'Pie'], ['Product SKU', 2, 'C-999'], ['Category', 2, 'Drinks'], ['Retail Price', 2, 231],
    ['Product1 SKU', 2, '844429818874'], ['Product1 Rate', 2, 0.6], ['Product30 SKU', 4, '843258536022'], ['Product30 Rate', 4, 31],
  ];
  it.each(COMPOSITE_CASES)('Composite: %s changed → no, and the difference names it', (field, r, bad) => {
    const { plan, composite, keys } = build();
    const check = checkCompositeUpload(corrupt(composite.rows, r, col(field), bad), composite.sources, plan, keys);
    expect(check.rows[r - 2].identical).toBe('no');
    expect(check.rows[r - 2].differences[0]).toMatch(new RegExp(`^${field} mismatch: expected .*, found '${bad}'$`));
  });

  it('a shifted ingredient (Product2 moved into Product1) is caught', () => {
    const { plan, composite, keys } = build();
    let rows = corrupt(composite.rows, 3, col('Product1 SKU'), '00123');
    rows = corrupt(rows, 3, col('Product1 Rate'), 0.5);
    rows = corrupt(rows, 3, col('Product2 SKU'), null);
    rows = corrupt(rows, 3, col('Product2 Rate'), null);
    const check = checkCompositeUpload(rows, composite.sources, plan, keys);
    expect(check.rows[1].differences).toEqual([
      "Product1 SKU mismatch: expected (blank), found '00123'",
      "Product1 Rate mismatch: expected (blank), found '0.5'",
      "Product2 SKU mismatch: expected '00123', found (blank)",
      "Product2 Rate mismatch: expected '0.5', found (blank)",
    ]);
  });

  it('27. several mismatches in one row are all listed', () => {
    const { plan, composite, keys } = build();
    let rows = corrupt(composite.rows, 2, col('Retail Price'), 1);
    rows = corrupt(rows, 2, col('Product2 Rate'), 9);
    rows = corrupt(rows, 2, col('Barcode'), 'X');
    expect(checkCompositeUpload(rows, composite.sources, plan, keys).rows[0].differences).toEqual([
      "Retail Price mismatch: expected '230', found '1'",
      "Product2 Rate mismatch: expected '0.7', found '9'",
      "Barcode mismatch: expected (blank), found 'X'",
    ]);
  });

  it('28. no false identical when source data is missing: blank SKU or name, duplicate SKU', () => {
    const { plan } = build();
    const s = buildSimpleUpload([src(['', 'X-1', 1, 1, 'خام'], 2), src(['B', '', 1, 1, 'خام'], 3), src(['C', 'X-1', 1, 1, 'خام'], 4)], plan);
    const check = checkSimpleUpload(s.rows, s.sources, plan);
    expect(check.rows.map((r) => [r.identical, r.differences])).toEqual([
      ['no', ['Product Name is blank in the source']],
      ['no', ['Product SKU is blank in the source']],
      ['no', ["Product SKU 'X-1' is also on source row 2"]],
    ]);
  });

  it('a renamed or reordered header, or a missing spec row, is reported as file structure', () => {
    const { plan, composite, keys } = build();
    const renamed = composite.rows.map((r, i) => (i === 0 ? r.map((h) => (h === 'Product1 Rate' ? 'Product 1 Rate' : h)) : r));
    expect(checkCompositeUpload(renamed, composite.sources, plan, keys).structure).toEqual([
      "Header row differs from the template at column 15: expected 'Product1 Rate', found 'Product 1 Rate'.",
    ]);
    const longSpec = composite.rows.map((r, i) => (i === 1 ? [...r, 'extra'] : r));
    expect(checkCompositeUpload(longSpec, composite.sources, plan, keys).structure).toEqual(['Row 2 differs from the template\'s specification row.']);
    const noSpec = [composite.rows[0], ...composite.rows.slice(2)];
    expect(checkCompositeUpload(noSpec, composite.sources, plan, keys).structure).toContain('Row 2 differs from the template\'s specification row.');
  });
});

describe('reports', () => {
  it('the mapping audit lists every mapped column and all 30 pairs', () => {
    const rows = mappingAuditRows(build().plan, 'الخامات', 'المنتج المجمع');
    expect(rows[0]).toEqual(['Source Sheet', 'Source Header', 'Output File', 'Output Header', 'Mapping Type', 'Status']);
    expect(rows).toHaveLength(1 + 5 + 4 + 60);
    expect(rows[3]).toEqual(['الخامات', 'سعر التكلفة غير شامل الضريبة للوحدة الواحدة', 'Simple', 'Cost', 'automatic', 'PASS']);
    expect(rows.slice(-2)).toEqual([
      ['المنتج المجمع', 'الرمز التعريفي للمادة الخام رقم 29 مطابق لرمز المرفوع علي النظام', 'Composite', 'Product29 SKU', 'automatic', 'PASS'].map((x, i) => (i === 1 ? ingHeaders(30)[0] : i === 3 ? 'Product30 SKU' : x)),
      ['المنتج المجمع', ingHeaders(30)[1], 'Composite', 'Product30 Rate', 'automatic', 'PASS'],
    ]);
    // A slot the source does not have is listed, as blank.
    const ten = planReadyToUpload(RAW_AR, COMP_AR.slice(0, 4 + 20));
    expect(mappingAuditRows(ten, 'R', 'C').slice(-1)[0]).toEqual(['C', '(none)', 'Composite', 'Product30 Rate', 'automatic', 'NOT IN SOURCE (left blank)']);
  });

  it('the check sheet and the summary', () => {
    const { plan, simple, composite, keys } = build();
    const s = checkSimpleUpload(simple.rows, simple.sources, plan);
    const c = checkCompositeUpload(composite.rows, composite.sources, plan, keys);
    expect(checkSheetRows(s)[1]).toEqual([2, '843258536022', 'زيت دوار الشمس', 'yes', '']);
    expect(readySummary(s, c, composite, keys)).toEqual({
      simpleRows: 5, compositeRows: 3, simpleIdentical: 5, compositeIdentical: 3, materialsUsed: 5, ingredientLinks: 2 + 2 + 30, missingIngredients: 0,
    });
  });
});
