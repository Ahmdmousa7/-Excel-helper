import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { readFileSync } from 'node:fs';
import {
  isRewaaTemplate,
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

/** The options `readExcelFile` passes to SheetJS — kept identical on purpose. */
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
 * contain real Arabic. **The app's own read path does NOT do this** — see the
 * TD-050 test: a BOM-less UTF-8 CSV comes out as mojibake through
 * `readExcelFile`. Headers are ASCII, so template MAPPING is unaffected either
 * way; that is why this increment is not blocked on TD-050.
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

  it('headers load identically through the app’s exact path — mapping does not depend on TD-050', () => {
    const viaApp = cleanTemplateHeaders(rowsOf(fixtureBytes('rewaa-simple-template.csv'))[0]);
    expect(viaApp).toEqual(SIMPLE_HEADERS);
  });

  it('KNOWN DEFECT (TD-050): the app’s read path turns BOM-less UTF-8 Arabic into mojibake', () => {
    // Measured 2026-09-28. `readExcelFile` hands SheetJS the bytes with no
    // codepage, so a UTF-8 CSV without a BOM — what Google Sheets exports, and
    // what this template is — is decoded as Latin-1. With a BOM, or with
    // `codepage: 65001`, it decodes correctly. Not fixed here: `readExcelFile`
    // also reads legacy .xls, where forcing a codepage is not obviously safe.
    const viaApp = String(rowsOf(fixtureBytes('rewaa-simple-template.csv'))[2][0]);
    expect(/\p{Script=Arabic}/u.test(viaApp)).toBe(false); // no Arabic-script letter survives the decode
    expect(String(SIMPLE[2][0])).toContain('حوار بلدي الكيلو'); // decoded as UTF-8
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
