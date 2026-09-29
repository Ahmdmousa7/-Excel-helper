import { describe, it, expect } from 'vitest';
import { collectHeaders, parsePriceRange, applyPriceRanges } from '../../utils/ocrPostProcess';
import { autoMap, mapRowsToTemplate, isVariableRow } from '../../utils/templateMapping';

const EN_DASH = String.fromCharCode(0x2013);
const EM_DASH = String.fromCharCode(0x2014);

describe('collectHeaders — the mapping panel sees every row, not just the first', () => {
  // Reproduction of the live run: the menu opened with simple items, so the
  // first row had no variant columns, and the panel never offered them.
  const rows = [
    { 'Product Name': 'Tea | شاي', 'Retail Price': 13, Type: 'Simple' },
    { 'Product Name': 'Dye | صبغة', 'Option 1': 'Length', 'Option 1 Value': 'Short | القصير', 'Retail Price': 400, Type: 'Variable', 'Variant Name': 'Short' },
    { 'Product Name': 'Dye | صبغة', 'Option 1': 'Length', 'Option 1 Value': 'Medium | الوسط', 'Option 2': 'Tone', 'Option 2 Value': 'Dark', 'Retail Price': 500, Type: 'Variable' },
  ];

  it('includes variant columns that appear only in later rows, in first-seen order', () => {
    expect(collectHeaders(rows)).toEqual([
      'Product Name', 'Retail Price', 'Type', 'Option 1', 'Option 1 Value', 'Variant Name', 'Option 2', 'Option 2 Value',
    ]);
  });

  it('keeps the existing headers first and only appends new ones (file mode, batch by batch)', () => {
    const first = collectHeaders([rows[0]]);
    expect(collectHeaders(rows.slice(1), first).slice(0, first.length)).toEqual(first);
    expect(collectHeaders(rows.slice(1), first)).toContain('Option 1 Value');
    expect(collectHeaders([rows[0]], first)).toEqual(first); // nothing new: unchanged
  });

  it('ignores non-object rows', () => {
    expect(collectHeaders([null, 'x', 3, { A: 1 }] as unknown[])).toEqual(['A']);
  });

  it('END TO END (pure): the Variable sheet now receives the option values', () => {
    // The Rewaa Variable template's relevant columns (plus its signature columns,
    // so it is recognised as Rewaa). The real template is exercised in e2e.
    const tmpl = [
      'Product Name', 'Variant SKU', 'Variant Name', 'Option 1', 'Option 1 Value', 'Variant Retail Price',
      'Enable stock management', 'Tracked by batch', 'Tracked by serial',
    ];
    // Before: headers from the first row only — no source for Option 1 / Option 1 Value.
    const before = autoMap(tmpl, Object.keys(rows[0]));
    expect(before['Option 1 Value']).toBeFalsy();
    // After: headers from every row.
    const mapping = autoMap(tmpl, collectHeaders(rows));
    expect(mapping['Option 1']).toBe('Option 1');
    expect(mapping['Option 1 Value']).toBe('Option 1 Value');
    const out = mapRowsToTemplate(rows.filter(isVariableRow), mapping, tmpl);
    expect(out.map((r) => r['Option 1 Value'])).toEqual(['Short | القصير', 'Medium | الوسط']);
    expect(out.map((r) => r['Option 1'])).toEqual(['Length', 'Length']);
    expect(out[0]['Variant Name']).toBe('Short'); // mapped value kept as extracted
    expect(out[1]['Variant Name']).toBeTruthy(); // built when the model left it out
  });
});

describe('parsePriceRange', () => {
  it.each([
    ['600-900', '600', '900'],
    [`600${EN_DASH}900`, '600', '900'],
    [`600${EM_DASH}900`, '600', '900'],
    ['600 - 900', '600', '900'],
    [`50${EN_DASH}100`, '50', '100'],
    [`1000${EM_DASH}1500`, '1000', '1500'],
    ['من 600 - 900 ريال', '600', '900'],
    [`الطويل ${'٦٠٠'}${EN_DASH}${'٩٠٠'} ر.س`, '600', '900'],
    ['SR 1,000-1,500', '1,000', '1,500'],
    ['12.5-20', '12.5', '20'],
  ])('%s -> %s to %s', (value, from, to) => {
    expect(parsePriceRange(value)).toEqual({ from, to });
  });

  it.each([[600], ['600'], ['600 ريال'], [''], [null], [undefined], ['free']])('%s is not a range', (value) => {
    expect(parsePriceRange(value)).toBeNull();
  });
});

describe('applyPriceRanges — a range is ONE row, Price 0, range in the Description', () => {
  const dye = (value: string, price: unknown, extra: Record<string, unknown> = {}) => ({
    'Product Name': 'Hair Dye | صبغة شعر', Category: 'Hair | الشعر',
    'Option 1': 'Length', 'Option 1 Value': value, 'Retail Price': price, Type: 'Variable', ...extra,
  });

  it.each([
    ['hyphen', '600-900'],
    ['en dash', `600${EN_DASH}900`],
    ['em dash', `600${EM_DASH}900`],
  ])('%s: one row, Price exactly 0, "Price range: 600 to 900"', (_, price) => {
    const { rows, ranges, mergedAway } = applyPriceRanges([dye('Long | الطويل', price)]);
    expect(rows).toHaveLength(1);
    expect(rows[0]['Retail Price']).toBe(0);
    expect(rows[0].Description).toBe('Price range: 600 to 900');
    expect(rows[0]['Option 1 Value']).toBe('Long | الطويل'); // variant preserved
    expect(rows[0]['Product Name']).toBe('Hair Dye | صبغة شعر');
    expect(ranges).toBe(1);
    expect(mergedAway).toBe(0);
  });

  it('the business examples: 50–100 and 1000—1500', () => {
    const { rows } = applyPriceRanges([
      { 'Product Name': 'A', 'Retail Price': `50${EN_DASH}100` },
      { 'Product Name': 'B', 'Retail Price': `1000${EM_DASH}1500` },
    ]);
    expect(rows.map((r) => [r['Retail Price'], r.Description])).toEqual([
      [0, 'Price range: 50 to 100'],
      [0, 'Price range: 1000 to 1500'],
    ]);
  });

  it('a single price stays exactly as it is — number or string', () => {
    const input = [dye('Short | القصير', 400), dye('Medium | الوسط', '600'), { 'Product Name': 'Tea', 'Retail Price': 13 }];
    const { rows, ranges } = applyPriceRanges(input);
    expect(rows).toEqual(input);
    expect(ranges).toBe(0);
  });

  it('multiple variants with DIFFERENT ranges each keep their own range', () => {
    const { rows } = applyPriceRanges([
      dye('Short | القصير', '300-400'),
      dye('Medium | الوسط', `450${EN_DASH}550`),
      dye('Long | الطويل', `600${EM_DASH}900`),
    ]);
    expect(rows).toHaveLength(3);
    expect(rows.map((r) => r['Retail Price'])).toEqual([0, 0, 0]);
    expect(rows.map((r) => r.Description)).toEqual([
      'Price range: 300 to 400', 'Price range: 450 to 550', 'Price range: 600 to 900',
    ]);
    expect(rows.map((r) => r['Option 1 Value'])).toEqual(['Short | القصير', 'Medium | الوسط', 'Long | الطويل']);
  });

  it('Arabic text around the range', () => {
    const { rows } = applyPriceRanges([dye('Long | الطويل', `من 600 ${EN_DASH} 900 ريال`)]);
    expect(rows[0]['Retail Price']).toBe(0);
    expect(rows[0].Description).toBe('Price range: 600 to 900');
  });

  it('an existing description is kept, with the range text after it', () => {
    const { rows } = applyPriceRanges([dye('Long | الطويل', '600-900', { Description: 'Includes wash | يشمل الغسيل' })]);
    expect(rows[0].Description).toBe('Includes wash | يشمل الغسيل; Price range: 600 to 900');
  });

  it('uses the price column under the other names the AI gives it', () => {
    const { rows } = applyPriceRanges([{ Name: 'X', Price: '20-30', Desc: '' }]);
    expect(rows[0]).toEqual({ Name: 'X', Price: 0, Desc: 'Price range: 20 to 30' });
  });

  it('does not modify its input', () => {
    const input = [dye('Long | الطويل', '600-900')];
    const copy = JSON.parse(JSON.stringify(input));
    applyPriceRanges(input);
    expect(input).toEqual(copy);
  });

  describe('duplicate-variant protection', () => {
    it('REPRODUCTION: the live run split "الطويل 600–900" into two Long rows — merged back to one', () => {
      // The exact shape the model returned on 2026-09-29 (ocr-result.xlsx).
      const { rows, mergedAway } = applyPriceRanges([
        dye('Short | القصير', 400),
        dye('Medium | الوسط', 500),
        dye('Long | الطويل', 600),
        dye('Long | الطويل', 900),
      ]);
      expect(mergedAway).toBe(1);
      expect(rows).toHaveLength(3);
      expect(rows.filter((r) => r['Option 1 Value'] === 'Long | الطويل')).toHaveLength(1);
      const long = rows.find((r) => r['Option 1 Value'] === 'Long | الطويل')!;
      expect(long['Retail Price']).toBe(0);
      expect(long.Description).toBe('Price range: 600 to 900');
      // The other variants' ordinary prices are untouched.
      expect(rows.slice(0, 2).map((r) => r['Retail Price'])).toEqual([400, 500]);
      expect(rows.slice(0, 2).every((r) => r.Description === undefined)).toBe(true);
    });

    it('REPRODUCTION (exact live shape): an invented "Range | المدى" Option 2 does not hide the duplicate', () => {
      // ocr-result.xlsx, 2026-09-29: the two Long rows differed ONLY in an Option 2
      // the model made up for the split — Small | صغير at 600, Large | كبير at 900.
      const live = (value: string, price: number, extra: Record<string, unknown> = {}) => ({
        'Variant SKU': '', Category: 'قسم الصبغات | Hair Coloring Section',
        'Product Name': 'صبغات شعر لون واحد | Hair color single tone', Description: '',
        'Retail Price': price, Type: 'Variable', 'Enable stock management': 'no',
        'Option 1': 'Size | الحجم', 'Option 1 Value': value, ...extra,
      });
      const { rows, mergedAway } = applyPriceRanges([
        live('Short | القصير', 400),
        live('Medium | الوسط', 500),
        live('Long | الطويل', 600, { 'Option 2': 'Range | المدى', 'Option 2 Value': 'Small | صغير' }),
        live('Long | الطويل', 900, { 'Option 2': 'Range | المدى', 'Option 2 Value': 'Large | كبير' }),
      ]);
      expect(mergedAway).toBe(1);
      expect(rows.map((r) => [r['Option 1 Value'], r['Retail Price'], r.Description])).toEqual([
        ['Short | القصير', 400, ''],
        ['Medium | الوسط', 500, ''],
        ['Long | الطويل', 0, 'Price range: 600 to 900'],
      ]);
      // The invented dimension is gone with the split it described.
      expect(rows[2]['Option 2']).toBe('');
      expect(rows[2]['Option 2 Value']).toBe('');
    });

    it('a REAL second dimension (not named as a range) still separates variants', () => {
      const input = [
        dye('Long | الطويل', 600, { 'Option 2': 'Tone | الدرجة', 'Option 2 Value': 'Light | فاتح' }),
        dye('Long | الطويل', 900, { 'Option 2': 'Tone | الدرجة', 'Option 2 Value': 'Dark | غامق' }),
      ];
      expect(applyPriceRanges(input).rows).toEqual(input);
    });

    it('endpoints are ordered low to high whatever order the rows came in', () => {
      const { rows } = applyPriceRanges([dye('Long | الطويل', '900'), dye('Long | الطويل', '600')]);
      expect(rows).toHaveLength(1);
      expect(rows[0].Description).toBe('Price range: 600 to 900');
    });

    it('same option values and the SAME price are not a range: left alone', () => {
      const input = [dye('Long | الطويل', 600), dye('Long | الطويل', 600)];
      expect(applyPriceRanges(input).rows).toEqual(input);
    });

    it('different option values are different variants, not a split range', () => {
      const input = [dye('Short | القصير', 400), dye('Long | الطويل', 900)];
      expect(applyPriceRanges(input).rows).toEqual(input);
    });

    it('the same product in DIFFERENT categories is not merged', () => {
      const input = [dye('Long | الطويل', 600), dye('Long | الطويل', 900, { Category: 'Other' })];
      expect(applyPriceRanges(input).rows).toHaveLength(2);
    });

    it('simple items without option values are never merged', () => {
      const input = [
        { 'Product Name': 'Tea', Category: 'Drinks', 'Retail Price': 10 },
        { 'Product Name': 'Tea', Category: 'Drinks', 'Retail Price': 12 },
      ];
      expect(applyPriceRanges(input).rows).toEqual(input);
    });

    it('a range cell and a split pair in one extraction both become single rows', () => {
      const { rows } = applyPriceRanges([
        dye('Long | الطويل', `600${EN_DASH}900`),
        { ...dye('Long | الطويل', 600), 'Product Name': 'Highlights | هايلايت' },
        { ...dye('Long | الطويل', 800), 'Product Name': 'Highlights | هايلايت' },
      ]);
      expect(rows).toHaveLength(2);
      expect(rows.map((r) => [r['Retail Price'], r.Description])).toEqual([
        [0, 'Price range: 600 to 900'], [0, 'Price range: 600 to 800'],
      ]);
    });
  });
});
