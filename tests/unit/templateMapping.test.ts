import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { readWorkbookBytes } from '../../services/workbookBytes';
import { readFileSync } from 'node:fs';
import {
  toYesNo,
  buildVariantName,
  isVariableRow,
  stripForSimple,
  stripForVariable,
  matchesTemplate,
  isCsvFile,
  parseCsvTemplate,
  isRewaaTemplate,
  refreshMapping,
  normalizeHeader,
  resolveSourceKey,
  autoMap,
  mapRowsToTemplate,
  defaultFor,
  cleanTemplateHeaders,
  TEMPLATE_DEFAULTS,
} from '../../utils/templateMapping';

/**
 * OCR → Rewaa template mapping, tested against the REAL templates supplied on
 * 2026-09-28 (`tests/fixtures/rewaa-*-template.csv`), not a transcription.
 *
 * The golden tests at the bottom are the ones that matter: they feed the
 * mapper only what an OCR extraction would produce, and assert the output is
 * cell-for-cell the data row the template's own author wrote.
 */

/**
 * RAW SheetJS on bytes, with readExcelFile's options — what readExcelFile did
 * BEFORE TD-050 was fixed. Kept to show why readWorkbookBytes exists.
 */
const APP_READ_OPTS = { type: 'array', raw: true, cellNF: true } as const;

function fixtureBytes(name: string): ArrayBuffer {
  const buf = readFileSync(new URL(`../fixtures/${name}`, import.meta.url));
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}

function rowsOf(ab: ArrayBuffer, extra: Record<string, unknown> = {}): unknown[][] {
  const wb = XLSX.read(ab, { ...APP_READ_OPTS, ...extra });
  return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {
    header: 1, defval: '', raw: false,
  }) as unknown[][];
}

/**
 * Fixtures are decoded as UTF-8 (`codepage: 65001`) so the golden rows below
 * contain real Arabic. The app does the equivalent through readWorkbookBytes
 * (TD-050, fixed 2026-09-28); SheetJS on raw bytes alone does not.
 */
const loadTemplate = (name: string) => rowsOf(fixtureBytes(name), { codepage: 65001 });

const SIMPLE = loadTemplate('rewaa-simple-template.csv');
const VARIABLE = loadTemplate('rewaa-variable-template.csv');
const SIMPLE_HEADERS = cleanTemplateHeaders(SIMPLE[0]);
const VARIABLE_HEADERS = cleanTemplateHeaders(VARIABLE[0]);

describe('the templates load through the app’s own read path', () => {
  it('Simple has 43 columns and Variable has 27', () => {
    expect(SIMPLE_HEADERS).toHaveLength(43);
    expect(VARIABLE_HEADERS).toHaveLength(27);
  });

  it('the header row is row 1 — the spec row is NOT mistaken for headers (D7)', () => {
    expect(SIMPLE_HEADERS[0]).toBe('Product Name');
    expect(SIMPLE_HEADERS[1]).toBe('Product SKU');
    expect(String(SIMPLE[1][0])).toBe('Text | required'); // row 2 is the spec row
  });

  it('headers load identically through the app’s real read path', () => {
    const wb = readWorkbookBytes(new Uint8Array(fixtureBytes('rewaa-simple-template.csv')), 'template.csv', { raw: true, cellNF: true });
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '', raw: false }) as unknown[][];
    expect(cleanTemplateHeaders(rows[0])).toEqual(SIMPLE_HEADERS);
  });

  it('TD-050 FIXED: the app’s read path keeps BOM-less UTF-8 Arabic', () => {
    // SheetJS handed raw bytes still decodes this as Latin-1 — that is library
    // behaviour and it has not changed. What changed is that the app no longer
    // hands it raw bytes for a CSV: readWorkbookBytes decodes the text first.
    //
    // This test USED to be titled "KNOWN DEFECT" and pinned only the first
    // line below, with a note that it would fail once the defect was fixed.
    // It would not have: it tested SheetJS, not the app. Both are asserted now.
    const rawSheetJs = String(rowsOf(fixtureBytes('rewaa-simple-template.csv'))[2][0]);
    expect(/\p{Script=Arabic}/u.test(rawSheetJs)).toBe(false); // the library, unchanged
    const wb = readWorkbookBytes(new Uint8Array(fixtureBytes('rewaa-simple-template.csv')), 'template.csv', { raw: true, cellNF: true });
    const viaApp = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '', raw: false }) as unknown[][];
    expect(String(viaApp[2][0])).toContain('حوار بلدي الكيلو'); // the app, fixed
  });
});

describe('normalizeHeader', () => {
  it('ignores case, whitespace, separators and a leading BOM', () => {
    expect(normalizeHeader('Retail Price')).toBe('retail price');
    expect(normalizeHeader('  retail   PRICE ')).toBe('retail price');
    expect(normalizeHeader('retail_price')).toBe('retail price');
    expect(normalizeHeader('\uFEFFProduct Name')).toBe('product name');
  });

  it('cleanTemplateHeaders strips a BOM from the first header only', () => {
    expect(cleanTemplateHeaders(['\uFEFFProduct Name', 'SKU'])).toEqual(['Product Name', 'SKU']);
  });
});

describe('resolveSourceKey', () => {
  it('REGRESSION: `Regular price` feeds `Retail Price`', () => {
    // The exact spelling that produced blank prices, and a FALSE parity flag on
    // correct rows, in an earlier implementation.
    expect(resolveSourceKey('Retail Price', ['Product Name', 'Regular price'])).toBe('Regular price');
  });

  it('an exact match beats a synonym', () => {
    expect(resolveSourceKey('Retail Price', ['Price', 'Retail Price'])).toBe('Retail Price');
  });

  it('matches case-insensitively, as the old auto-map did', () => {
    expect(resolveSourceKey('Product Name', ['product name'])).toBe('product name');
  });

  it('SKU and barcode resolve for the variable template’s own spellings', () => {
    expect(resolveSourceKey('Variant SKU', ['sku'])).toBe('sku');
    expect(resolveSourceKey('Variant BARCODE', ['Barcode'])).toBe('Barcode');
  });

  it('does not match a pack column to the product-level field', () => {
    // `barcode` must not leak into `Pack1 Barcode`, or every pack would inherit
    // the product's barcode and the import would reject duplicates.
    expect(resolveSourceKey('Pack1 Barcode', ['Barcode'])).toBeUndefined();
  });

  it('returns undefined rather than guessing', () => {
    expect(resolveSourceKey('Tax Code', ['Product Name', 'Price'])).toBeUndefined();
  });
});

describe('autoMap', () => {
  it('never overwrites an existing entry — including an explicit "-- Ignore --"', () => {
    const m = autoMap(['Retail Price', 'Product Name'], ['Price', 'Product Name'], {
      'Retail Price': '', // the user chose Ignore
    });
    expect(m['Retail Price']).toBe('');
    expect(m['Product Name']).toBe('Product Name');
  });

  it('leaves unmatched headers ABSENT so a later extraction can still fill them', () => {
    // Template loaded before extraction: nothing to match yet.
    const before = autoMap(SIMPLE_HEADERS, []);
    expect(Object.keys(before)).toHaveLength(0);
    // Extraction arrives; the same call fills what it can.
    const after = autoMap(SIMPLE_HEADERS, ['Product Name', 'Regular price'], before);
    expect(after['Product Name']).toBe('Product Name');
    expect(after['Retail Price']).toBe('Regular price');
  });
});

describe('mapRowsToTemplate', () => {
  // A minimal REWAA-shaped template: the three signature columns plus a Rewaa
  // SKU column, so defaults apply. See the scoping block below for non-Rewaa.
  const headers = [
    'Product Name', 'Product SKU', 'Sellable', 'Retail Price', 'Tax Code',
    'Enable stock management', 'Tracked by batch', 'Tracked by serial',
  ];

  it('fills a column with no source from the template default', () => {
    const [out] = mapRowsToTemplate([{ n: 'X' }], { 'Product Name': 'n' }, headers);
    expect(out.Sellable).toBe('yes');
  });

  it('never lets a default override extracted data', () => {
    const [out] = mapRowsToTemplate([{ n: 'X', s: 'no' }], { 'Product Name': 'n', Sellable: 's' }, headers);
    expect(out.Sellable).toBe('no');
  });

  it('treats a blank extracted value as missing, so the default applies', () => {
    const [out] = mapRowsToTemplate([{ s: '   ' }], { Sellable: 's' }, headers);
    expect(out.Sellable).toBe('yes');
  });

  it('an explicit Ignore still gets the default — Ignore means "no source", not "no value"', () => {
    const [out] = mapRowsToTemplate([{ s: 'no' }], { Sellable: '' }, headers);
    expect(out.Sellable).toBe('yes');
  });

  it('Retail Price has NO default: a missing price stays visibly blank, never 0', () => {
    // A 0 retail price imports as a free product.
    const [out] = mapRowsToTemplate([{}], {}, headers);
    expect(out['Retail Price']).toBe('');
    expect(defaultFor('Retail Price')).toBeUndefined();
  });

  it('a column with no default and no source is an empty string', () => {
    const [out] = mapRowsToTemplate([{}], {}, headers);
    expect(out['Tax Code']).toBe('');
  });

  it('emits exactly the template’s columns, in the template’s order', () => {
    const [out] = mapRowsToTemplate([{ extra: 1 }], {}, headers);
    expect(Object.keys(out)).toEqual(headers);
  });

  it('keeps a numeric 0 that was actually extracted', () => {
    // isBlank must not treat 0 as blank.
    const [out] = mapRowsToTemplate([{ p: 0 }], { 'Retail Price': 'p' }, headers);
    expect(out['Retail Price']).toBe(0);
  });
});

describe('defaults match the real templates', () => {
  it('Enable stock management defaults to `no`, as every sample row shows', () => {
    expect(defaultFor('Enable stock management')).toBe('no');
  });

  it('every default names a column that exists in one of the two templates', () => {
    // Guards against a typo'd default silently never applying.
    const all = new Set([...SIMPLE_HEADERS, ...VARIABLE_HEADERS].map(normalizeHeader));
    for (const key of Object.keys(TEMPLATE_DEFAULTS)) {
      expect(all.has(key), `default for "${key}" matches no template column`).toBe(true);
    }
  });
});

/**
 * GOLDEN: give the mapper only what OCR would plausibly extract, and require
 * the result to equal the template author's own data row, cell for cell.
 */
describe('GOLDEN — output equals the template’s own sample rows', () => {
  const asText = (v: unknown) => (v === undefined || v === null ? '' : String(v));

  it('Simple: name, SKU, category and price in → the full 43-column row out', () => {
    const expected = SIMPLE[2].map(asText);
    const extracted = {
      'Product Name': expected[0],
      SKU: expected[1],
      Category: expected[3],
      'Regular price': expected[13], // the problem spelling, on purpose
    };
    const mapping = autoMap(SIMPLE_HEADERS, Object.keys(extracted));
    const [out] = mapRowsToTemplate([extracted], mapping, SIMPLE_HEADERS);

    expect(SIMPLE_HEADERS.map((h) => asText(out[h]))).toEqual(expected);
  });

  it('Variable: the extracted variant fields in → the full 27-column row out', () => {
    const expected = VARIABLE[2].map(asText);
    const extracted = {
      'Product Name': expected[0],
      Category: expected[1],
      'Option 1': expected[5],
      'Option 1 Value': expected[6],
      'Variant Name': expected[11], // construction is a later increment
      'Variant SKU': expected[12],
      'Retail Price': 0, // the sample genuinely has 0 here; it is data, not a default
    };
    const mapping = autoMap(VARIABLE_HEADERS, Object.keys(extracted));
    const [out] = mapRowsToTemplate([extracted], mapping, VARIABLE_HEADERS);

    expect(VARIABLE_HEADERS.map((h) => asText(out[h]))).toEqual(expected);
  });

  it('BEFORE this change, the same Simple input produced a row full of blanks', () => {
    // What the old mapDataToTemplate did: exact case-insensitive match, `''`
    // for everything else. Kept to show the size of the gap, not to guard it.
    const expected = SIMPLE[2].map(asText);
    const extracted: Record<string, unknown> = {
      'Product Name': expected[0], SKU: expected[1], Category: expected[3], 'Regular price': expected[13],
    };
    const oldMapping: Record<string, string> = {};
    SIMPLE_HEADERS.forEach((h) => {
      const m = Object.keys(extracted).find((k) => k.toLowerCase() === h.toLowerCase());
      if (m) oldMapping[h] = m;
    });
    const oldRow = SIMPLE_HEADERS.map((h) => (oldMapping[h] ? asText(extracted[oldMapping[h]]) : ''));

    const wrong = SIMPLE_HEADERS.filter((h, i) => oldRow[i] !== expected[i]);
    expect(wrong).toContain('Retail Price'); // the price was lost
    expect(wrong).toContain('Product SKU');  // `SKU` did not match
    expect(wrong).toContain('Sellable');     // no defaults at all
    expect(wrong.length).toBeGreaterThan(20);
  });
});

describe('header names that collide with Object.prototype', () => {
  /**
   * A template header is arbitrary user text. Before the own-property guards, a
   * column named `constructor` crashed the mapper (it resolved to `Object`
   * itself, which is not iterable) and one named `__proto__` vanished from the
   * output (assigning to it sets the prototype, not a key). Both measured.
   */
  const collisions = ['constructor', '__proto__', 'toString', 'hasOwnProperty', 'valueOf'];

  it.each(collisions)('`%s` does not crash, has no default and no synonym', (h) => {
    expect(() => resolveSourceKey(h, ['x'])).not.toThrow();
    expect(resolveSourceKey(h, ['x'])).toBeUndefined();
    expect(defaultFor(h)).toBeUndefined();
  });

  it.each(collisions)('`%s` survives as a real column in the output', (h) => {
    const [out] = mapRowsToTemplate([{ src: 'v' }], autoMap([h], []), [h]);
    expect(Object.keys(out)).toEqual([h]);
    expect(out[h]).toBe('');
  });

  it('`__proto__` can be MAPPED like any other column', () => {
    const mapping = autoMap(['__proto__'], ['__proto__']);
    expect(Object.keys(mapping)).toEqual(['__proto__']);
    const row: Record<string, unknown> = {};
    Object.defineProperty(row, '__proto__', { value: 'kept', enumerable: true });
    const [out] = mapRowsToTemplate([row], mapping, ['__proto__']);
    expect(Object.getOwnPropertyDescriptor(out, '__proto__')?.value).toBe('kept');
  });
});

describe('defaults are scoped to Rewaa templates', () => {
  /**
   * The mapping panel accepts ANY template. Rewaa's defaults must not leak into
   * a Salla, Zid or custom sheet that happens to share a column name.
   */
  it('both real Rewaa templates are recognised', () => {
    expect(isRewaaTemplate(SIMPLE_HEADERS)).toBe(true);
    expect(isRewaaTemplate(VARIABLE_HEADERS)).toBe(true);
  });

  it('a generic sheet with the same column NAMES is not', () => {
    expect(isRewaaTemplate(['Name', 'SKU', 'Price', 'Sellable', 'Cost', 'Weighted'])).toBe(false);
  });

  it('the signature columns alone are not enough without a Rewaa SKU column', () => {
    expect(isRewaaTemplate(['Enable stock management', 'Tracked by batch', 'Tracked by serial', 'SKU'])).toBe(false);
  });

  it('recognition survives case, spacing and a BOM', () => {
    expect(isRewaaTemplate(['\uFEFFproduct sku', 'ENABLE STOCK MANAGEMENT', 'tracked_by_batch', 'Tracked  by serial'])).toBe(true);
  });

  it('a NON-Rewaa template gets blanks, not Rewaa defaults', () => {
    const generic = ['Name', 'Sellable', 'Cost', 'Weighted'];
    const [out] = mapRowsToTemplate([{}], {}, generic);
    expect(out).toEqual({ Name: '', Sellable: '', Cost: '', Weighted: '' });
  });

  it('a non-Rewaa template still maps its data normally', () => {
    const [out] = mapRowsToTemplate([{ n: 'X', s: 'yes' }], { Name: 'n', Sellable: 's' }, ['Name', 'Sellable']);
    expect(out).toEqual({ Name: 'X', Sellable: 'yes' });
  });
});

describe('refreshMapping — a second extraction with different column names', () => {
  const H = [
    'Product Name', 'Product SKU', 'Retail Price',
    'Enable stock management', 'Tracked by batch', 'Tracked by serial',
  ];

  it('REGRESSION: a stale auto-mapping no longer exports the new prices as blank', () => {
    // Extraction 1 calls the price `Regular price`; extraction 2 calls it `Price`.
    // With autoMap alone the stale entry survived and 13 exported as ''.
    const first = refreshMapping(H, ['Product Name', 'Regular price'], {});
    expect(first['Retail Price']).toBe('Regular price');

    const second = refreshMapping(H, ['Product Name', 'Price'], first);
    expect(second['Retail Price']).toBe('Price');

    const [out] = mapRowsToTemplate([{ 'Product Name': 'Tea', Price: 13 }], second, H);
    expect(out['Retail Price']).toBe(13);
  });

  it('keeps an explicit "-- Ignore --" across extractions', () => {
    const next = refreshMapping(H, ['Product Name', 'Price'], { 'Retail Price': '' });
    expect(next['Retail Price']).toBe('');
  });

  it('keeps a user choice whose column still exists, even over a better synonym', () => {
    // The user deliberately pointed Retail Price at `Promo`; `Price` also exists.
    const next = refreshMapping(H, ['Promo', 'Price'], { 'Retail Price': 'Promo' });
    expect(next['Retail Price']).toBe('Promo');
  });

  it('drops a mapping whose column vanished, and leaves it absent if nothing replaces it', () => {
    const next = refreshMapping(H, ['Product Name'], { 'Retail Price': 'Regular price' });
    expect(Object.prototype.hasOwnProperty.call(next, 'Retail Price')).toBe(false);
  });

  it('is idempotent — refreshing twice with the same extraction changes nothing', () => {
    const once = refreshMapping(H, ['Product Name', 'Price', 'SKU'], {});
    expect(refreshMapping(H, ['Product Name', 'Price', 'SKU'], once)).toEqual(once);
  });
});

describe('CSV template upload decodes as UTF-8 — closing TD-050 for this path only', () => {
  /**
   * Goes through a real `File` and `File.text()`, which is what the upload
   * handler calls, rather than simulating the decode.
   */
  const asFile = (bytes: BlobPart, name = 'template.csv') => new File([bytes], name, { type: 'text/csv' });

  it('the real Rewaa template: same headers, and Arabic data intact', async () => {
    const buf = readFileSync(new URL('../fixtures/rewaa-simple-template.csv', import.meta.url));
    const rows = parseCsvTemplate(XLSX, await asFile(new Uint8Array(buf)).text());
    expect(cleanTemplateHeaders(rows[0])).toEqual(SIMPLE_HEADERS);
    expect(String(rows[2][0])).toContain('حوار بلدي الكيلو');
  });

  it('a template with ARABIC headers keeps them exactly', async () => {
    const csv = `اسم المنتج,السعر,الباركود
شاي,13,628
`;
    const rows = parseCsvTemplate(XLSX, await asFile(csv).text());
    expect(cleanTemplateHeaders(rows[0])).toEqual(['اسم المنتج', 'السعر', 'الباركود']);
  });

  it('CONTRAST: the same Arabic headers through RAW SheetJS on bytes come out as mojibake', () => {
    // Why a decode step exists at all. This was readExcelFile's read before TD-050.
    const bytes = new TextEncoder().encode(`اسم المنتج,السعر
شاي,13
`);
    const viaApp = rowsOf(bytes.buffer.slice(0) as ArrayBuffer)[0].map(String);
    expect(viaApp).not.toEqual(['اسم المنتج', 'السعر']);
    expect(/\p{Script=Arabic}/u.test(viaApp.join(''))).toBe(false);
  });

  it('a BOM-prefixed CSV does not leak the BOM into the first header', async () => {
    const withBom = new Uint8Array([0xef, 0xbb, 0xbf, ...new TextEncoder().encode(`Product Name,SKU
X,1
`)]);
    const rows = parseCsvTemplate(XLSX, await asFile(withBom).text());
    expect(cleanTemplateHeaders(rows[0])[0]).toBe('Product Name');
  });

  it('isCsvFile: by extension, case-insensitive, with MIME as a fallback', () => {
    expect(isCsvFile('Rewaa.CSV')).toBe(true);
    expect(isCsvFile('export', 'text/csv')).toBe(true);
    expect(isCsvFile('template.xlsx')).toBe(false);
    expect(isCsvFile('template.xls', 'application/vnd.ms-excel')).toBe(false);
  });
});

describe('part 2 — yes/no columns are enforced on Rewaa templates', () => {
  it('toYesNo accepts the common spellings, in English and Arabic', () => {
    for (const v of ['yes', 'YES', ' Yes ', 'y', 'true', 'TRUE', '1', 1, true, 'نعم']) expect(toYesNo(v)).toBe('yes');
    for (const v of ['no', 'No', 'n', 'false', '0', 0, false, 'لا']) expect(toYesNo(v)).toBe('no');
    for (const v of ['maybe', 'enabled', '2', '']) expect(toYesNo(v)).toBeUndefined();
  });

  it('an extracted `Yes` / `TRUE` / `نعم` arrives as the exact word the importer accepts', () => {
    const rows = [{ a: 'Yes', b: 'TRUE', c: 'نعم', d: 'No' }];
    const mapping = { Sellable: 'a', Purchasable: 'b', Weighted: 'c', 'Enable stock management': 'd' };
    const [out] = mapRowsToTemplate(rows, mapping, SIMPLE_HEADERS);
    expect([out.Sellable, out.Purchasable, out.Weighted, out['Enable stock management']]).toEqual(['yes', 'yes', 'yes', 'no']);
  });

  it('Enable stock management is ALWAYS `no` on a Rewaa template — an extracted `yes` does not survive', () => {
    // Approved Rewaa-template rule. The OCR prompt asks the model to fill this
    // column, so a `yes` can arrive; it must never reach a Rewaa export.
    for (const headers of [SIMPLE_HEADERS, VARIABLE_HEADERS]) {
      const rows = [{ s: 'yes' }, { s: 'Yes' }, { s: 'TRUE' }, { s: 'نعم' }, { s: 1 }, { s: 'no' }, { s: '' }, {}];
      const out = mapRowsToTemplate(rows, { 'Enable stock management': 's' }, headers);
      expect(out.map((r) => r['Enable stock management'])).toEqual(rows.map(() => 'no'));
    }
  });

  it('…while a NON-Rewaa template keeps the extracted value (the rule does not leak)', () => {
    const generic = ['Name', 'Enable stock management'];
    const [out] = mapRowsToTemplate([{ s: 'yes' }], { 'Enable stock management': 's' }, generic);
    expect(out['Enable stock management']).toBe('yes');
  });

  it('an out-of-list value falls back to the column default, as a blank does', () => {
    const [out] = mapRowsToTemplate([{ a: 'maybe' }], { 'Enable stock management': 'a' }, SIMPLE_HEADERS);
    expect(out['Enable stock management']).toBe('no');
  });

  it('pack flags are enforced too', () => {
    const [out] = mapRowsToTemplate([{ a: 'FALSE' }], { 'Pack2 Sellable': 'a' }, SIMPLE_HEADERS);
    expect(out['Pack2 Sellable']).toBe('no');
  });

  it('a NON-Rewaa template is left exactly as extracted', () => {
    const [out] = mapRowsToTemplate([{ a: 'Yes' }], { Sellable: 'a' }, ['Name', 'Sellable']);
    expect(out.Sellable).toBe('Yes');
  });
});

describe('part 2 — Variant Name is constructed when the extraction omits it', () => {
  it('GOLDEN: omitting Variant Name still reproduces the template’s own row exactly', () => {
    const expected = VARIABLE[2].map((v) => String(v ?? ''));
    const extracted = {
      'Product Name': expected[0], Category: expected[1],
      'Option 1': expected[5], 'Option 1 Value': expected[6],
      'Variant SKU': expected[12], 'Retail Price': 0,
    };
    const [out] = mapRowsToTemplate([extracted], autoMap(VARIABLE_HEADERS, Object.keys(extracted)), VARIABLE_HEADERS);
    expect(out['Variant Name']).toBe('حري | Hari | نص | Half');
    expect(VARIABLE_HEADERS.map((h) => String(out[h] ?? ''))).toEqual(expected);
  });

  it('joins every option value present, skipping blanks', () => {
    const out = { 'Product Name': 'Shirt', 'Option 1 Value': 'Red', 'Option 2 Value': '', 'Option 3 Value': 'L' };
    expect(buildVariantName(out, Object.keys(out))).toBe('Shirt | Red | L');
  });

  it('is blank without a product name, or without any option value', () => {
    expect(buildVariantName({ 'Product Name': '', 'Option 1 Value': 'Red' }, ['Product Name', 'Option 1 Value'])).toBe('');
    expect(buildVariantName({ 'Product Name': 'Shirt', 'Option 1 Value': '' }, ['Product Name', 'Option 1 Value'])).toBe('');
  });

  it('never overwrites a Variant Name the extraction supplied', () => {
    const row = { n: 'Shirt', o: 'Red', vn: 'Custom name' };
    const [out] = mapRowsToTemplate([row], { 'Product Name': 'n', 'Option 1 Value': 'o', 'Variant Name': 'vn' }, VARIABLE_HEADERS);
    expect(out['Variant Name']).toBe('Custom name');
  });

  it('is not added to a non-Rewaa template that happens to have the column', () => {
    const [out] = mapRowsToTemplate(
      [{ n: 'Shirt', o: 'Red' }],
      { 'Product Name': 'n', 'Option 1 Value': 'o' },
      ['Product Name', 'Option 1 Value', 'Variant Name'],
    );
    expect(out['Variant Name']).toBe('');
  });
});

describe('part 2 — routing moved out of OcrTab behaves exactly as before', () => {
  // The original inline code, verbatim, so the refactor is checked rather than trusted.
  const origIsSimple = (r: any) => {
    const t = String(r['Type'] || r['type'] || '').toLowerCase();
    return t === 'simple' || (!t.includes('variable') && !t.includes('var'));
  };
  const origIsVariable = (r: any) => {
    const t = String(r['Type'] || r['type'] || '').toLowerCase();
    return t.includes('variable') || t.includes('var');
  };
  const origStripSimple = (row: any) => {
    const n = { ...row };
    Object.keys(n)
      .filter((k) => { const l = k.toLowerCase(); return l.includes('option') || l.includes('variant'); })
      .forEach((k) => delete n[k]);
    return n;
  };
  const origStripVariable = (row: any) => {
    const n = { ...row };
    Object.keys(n)
      .filter((k) => { const l = k.toLowerCase(); return l === 'product sku' || l === 'product_sku'; })
      .forEach((k) => delete n[k]);
    return n;
  };
  const samples: any[] = [
    { Type: 'Simple' }, { Type: 'Variable' }, { type: 'variable' }, { Type: 'VAR' },
    { Type: '', type: 'Variable' }, {}, { Type: 'something' },
    { Type: 'Simple', 'Option 1': 'x', 'Variant SKU': 'y', 'Product SKU': 'z', Name: 'n' },
    { Type: 'Variable', 'Product SKU': 'a', product_sku: 'b', 'Variant SKU': 'c', 'Option 1 Value': 'd' },
  ];

  it.each(samples.map((row, i) => [i, row]))('sample %i routes identically', (_i, row) => {
    expect(isVariableRow(row)).toBe(origIsVariable(row));
    expect(!isVariableRow(row)).toBe(origIsSimple(row)); // exact complements
  });

  it.each(samples.map((row, i) => [i, row]))('sample %i strips identically, keys in the same order', (_i, row) => {
    expect(Object.entries(stripForSimple(row))).toEqual(Object.entries(origStripSimple(row)));
    expect(Object.entries(stripForVariable(row))).toEqual(Object.entries(origStripVariable(row)));
  });
});

describe('part 2 — comparison columns audit the mapping rather than restate it', () => {
  const generic = { 'Product Name': 'Tea', 'Regular price': 13, SKU: 'T-1', Category: 'Drinks', Type: 'Simple' };

  it('TRUE when every compared field arrived intact', () => {
    const [mapped] = mapRowsToTemplate([generic], autoMap(SIMPLE_HEADERS, Object.keys(generic)), SIMPLE_HEADERS);
    expect(matchesTemplate(generic, mapped, SIMPLE_HEADERS)).toBe(true);
  });

  it('FALSE when the price was mapped to the wrong column', () => {
    const wrong = { ...autoMap(SIMPLE_HEADERS, Object.keys(generic)), 'Retail Price': 'SKU' };
    const [mapped] = mapRowsToTemplate([generic], wrong, SIMPLE_HEADERS);
    expect(matchesTemplate(generic, mapped, SIMPLE_HEADERS)).toBe(false);
  });

  it('FALSE when the price was set to Ignore — the case the check exists for', () => {
    const ignored = { ...autoMap(SIMPLE_HEADERS, Object.keys(generic)), 'Retail Price': '' };
    const [mapped] = mapRowsToTemplate([generic], ignored, SIMPLE_HEADERS);
    expect(mapped['Retail Price']).toBe('');
    expect(matchesTemplate(generic, mapped, SIMPLE_HEADERS)).toBe(false);
  });

  it('a field the extraction left blank is not compared', () => {
    const noPrice = { 'Product Name': 'Iced Tea', Type: 'Simple' };
    const [mapped] = mapRowsToTemplate([noPrice], autoMap(SIMPLE_HEADERS, Object.keys(noPrice)), SIMPLE_HEADERS);
    expect(matchesTemplate(noPrice, mapped, SIMPLE_HEADERS)).toBe(true);
  });

  it('a constructed Variant Name is not treated as a mismatch', () => {
    const v = { 'Product Name': 'حري | Hari', 'Option 1 Value': 'نص | Half', 'Variant SKU': 'G-1', Type: 'Variable' };
    const [mapped] = mapRowsToTemplate([v], autoMap(VARIABLE_HEADERS, Object.keys(v)), VARIABLE_HEADERS);
    expect(mapped['Variant Name']).toBe('حري | Hari | نص | Half');
    expect(matchesTemplate(v, mapped, VARIABLE_HEADERS)).toBe(true);
  });
});
