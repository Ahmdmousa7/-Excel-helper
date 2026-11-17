import { describe, it, expect } from 'vitest';
import {
  parseSecondRead, normName, namesMatch, staticChecks, crossCheck, reviewRows, looseNumber, missingItemRow,
} from '../../utils/ocrReview';

const row = (name: string, price: unknown, extra: Record<string, unknown> = {}) =>
  ({ 'Product Name': name, 'Retail Price': price, 'Category': 'Hot | ساخن', 'Source File': 'menu.pdf', ...extra });

describe('ocrReview', () => {
  it('parses the second reading, tolerating fences, wrappers and Arabic digits', () => {
    expect(parseSecondRead('```json\n[{"name":"لاتيه","price":18}]\n```')).toEqual([{ name: 'لاتيه', price: 18 }]);
    expect(parseSecondRead('{"items":[{"name":"Tea","price":"٨"}]}')).toEqual([{ name: 'Tea', price: 8 }]);
    expect(parseSecondRead('Here: [{"name":"A","price":5},{"name":"","price":3},{"name":"B"}] done')).toEqual([{ name: 'A', price: 5 }]);
    expect(parseSecondRead('not json')).toEqual([]);
  });

  it('normalises Arabic names and matches the same item', () => {
    expect(normName('قهوة عربيّة')).toBe(normName('قهوه عربية'));
    expect(namesMatch(normName('لاتيه'), normName('لاتيه كبير'))).toBe(true);
    expect(namesMatch(normName('Latte'), normName('Cappuccino'))).toBe(false);
    expect(looseNumber('15 ر.س')).toBe(15);
  });

  it('flags missing, non-numeric, zero, duplicate and outlier prices — but not a price range', () => {
    const rows = [
      row('Hot Drinks | المشروبات الساخنة', ''),
      row('Tea | شاي', '١٥'),
      row('Water | مياه', 0),
      row('Juice | عصير', 0, { Description: 'Range: 20 - 30' }),
      row('Latte | لاتيه', 18), row('Latte | لاتيه', 18),
      row('Mocha | موكا', 20), row('Espresso | اسبريسو', 15), row('Big Pot | ابريق', 450),
    ];
    const codes = staticChecks(rows).map((f) => `${f.code}:${f.row['Product Name']}`);
    expect(codes).toContain('no-price:Hot Drinks | المشروبات الساخنة');
    expect(codes).toContain('bad-price:Tea | شاي');
    expect(codes).toContain('zero-price:Water | مياه');
    expect(codes).toContain('duplicate:Latte | لاتيه');
    expect(codes).toContain('outlier:Big Pot | ابريق');
    expect(codes.some((c) => c.includes('Juice'))).toBe(false);
    expect(staticChecks(rows).find((f) => f.code === 'bad-price')!.suggestions).toEqual([15]);
  });

  it('cross-checks prices against the second reading (the example: Latte 16 vs 18, Tea missing)', () => {
    const rows = [row('Arabic Coffee | قهوة عربية', 12), row('Latte | لاتيه', 16), row('Cappuccino | كابتشينو', 17)];
    const second = { 'menu.pdf': [
      { name: 'قهوة عربية', price: 12 }, { name: 'لاتيه', price: 18 }, { name: 'كابتشينو', price: 17 }, { name: 'شاي', price: 8 },
    ] };
    const { flags, missing } = crossCheck(rows, second);
    expect(flags).toHaveLength(1);
    expect(flags[0]).toMatchObject({ code: 'price-mismatch', level: 'error', suggestions: [18] });
    expect(flags[0].row['Product Name']).toBe('Latte | لاتيه');
    expect(missing.map((m) => [m.name, m.price])).toEqual([['شاي', 8]]);
  });

  it('confirms variants priced per size, and leaves files without a second reading alone', () => {
    const rows = [
      row('Latte | لاتيه', 16, { 'Option 1 Value': 'Small | صغير' }),
      row('Latte | لاتيه', 20, { 'Option 1 Value': 'Large | كبير' }),
      row('Tea | شاي', 8, { 'Source File': 'other.pdf' }),
    ];
    const r = reviewRows(rows, { 'menu.pdf': [{ name: 'لاتيه صغير', price: 16 }, { name: 'لاتيه كبير', price: 20 }] });
    expect(r.flags).toEqual([]);
    expect(r.missing).toEqual([]);
  });

  it('marks a row the second reading never saw as unconfirmed', () => {
    const { flags } = crossCheck([row('Pizza | بيتزا', 30)], { 'menu.pdf': [{ name: 'برجر', price: 25 }] });
    expect(flags.map((f) => f.code)).toEqual(['unconfirmed']);
  });

  it('builds a Simple row for a missing item', () => {
    expect(missingItemRow({ sourceFile: 'menu.pdf', name: 'شاي', price: 8, key: 'k' })).toMatchObject({
      'Product Name': 'شاي', 'Retail Price': 8, Type: 'Simple', 'Source File': 'menu.pdf',
    });
  });
});
