import { describe, it, expect } from 'vitest';
import {
  isScientificNotation,
  plainNumberString,
  scientificNumberOverride,
} from '../../utils/cellText';

/**
 * The values here are not invented. They are what SheetJS actually produces for a
 * workbook written and read back with plain JS numbers:
 *
 *   1234567890123    -> v=1234567890123    w="1.23457E+12"
 *   1234567890123456 -> v=1234567890123456 w="1.23457E+15"
 *   12345678901      -> v=12345678901      w="12345678901"   (11 digits, safe)
 *
 * Excel's General format switches to scientific at 12 digits, which is why
 * EAN-13 and UPC barcodes stored as numbers were the ones getting mangled.
 */

describe('isScientificNotation', () => {
  it('matches what Excel emits for long numbers', () => {
    expect(isScientificNotation('1.23457E+12')).toBe(true);
    expect(isScientificNotation('1.23E+12')).toBe(true);
    expect(isScientificNotation('-4e-9')).toBe(true);
    expect(isScientificNotation('  1.5E+21  ')).toBe(true);
  });

  it('does not match ordinary numbers or SKUs that merely contain E', () => {
    expect(isScientificNotation('12345678901')).toBe(false);
    expect(isScientificNotation('1234.5678')).toBe(false);
    expect(isScientificNotation('000123')).toBe(false);
    // The case it would be catastrophic to misfire on: a real SKU.
    expect(isScientificNotation('AB-0012-E5')).toBe(false);
    expect(isScientificNotation('E12')).toBe(false);
    expect(isScientificNotation('1.2E')).toBe(false);
  });
});

describe('plainNumberString', () => {
  it('returns exact digits for barcode-sized integers', () => {
    expect(plainNumberString(1234567890123)).toBe('1234567890123');
    expect(plainNumberString(1234567890123456)).toBe('1234567890123456');
    expect(plainNumberString(-1234567890123)).toBe('-1234567890123');
  });

  it('never returns exponential form', () => {
    expect(plainNumberString(1e21)).toBe('1000000000000000000000');
    expect(plainNumberString(1.5e21)).toBe('1500000000000000000000');
    expect(plainNumberString(1e-7)).toBe('0.0000001');
    for (const n of [1e21, 1.5e21, 1e-7, 1e-9, 5e300]) {
      expect(plainNumberString(n), String(n)).not.toMatch(/[eE]/);
    }
  });

  it('does not round decimals to three places', () => {
    // The previous implementation used toLocaleString without
    // maximumFractionDigits, which defaults to 3: 1234.5678 became "1234.568"
    // and 1e-7 became "0". Both were silent precision loss.
    expect(plainNumberString(1234.5678)).toBe('1234.5678');
    expect(plainNumberString(0.000012345)).toBe('0.000012345');
    expect(plainNumberString(1e-7)).not.toBe('0');
  });

  it('passes through non-finite values rather than inventing digits', () => {
    expect(plainNumberString(NaN)).toBe('NaN');
    expect(plainNumberString(Infinity)).toBe('Infinity');
  });
});

describe('scientificNumberOverride corrects the broken case', () => {
  it('recovers the true barcode from the scientific display', () => {
    expect(scientificNumberOverride({ t: 'n', v: 1234567890123, w: '1.23457E+12' }))
      .toBe('1234567890123');
    // What the old code produced instead — a plausible-looking wrong barcode.
    expect(scientificNumberOverride({ t: 'n', v: 1234567890123, w: '1.23457E+12' }))
      .not.toBe('1234570000000');
  });

  it('recovers a 16-digit number the display had cut to six digits', () => {
    expect(scientificNumberOverride({ t: 'n', v: 1234567890123456, w: '1.23457E+15' }))
      .toBe('1234567890123456');
  });

  it('corrects an explicitly scientific-formatted cell', () => {
    expect(scientificNumberOverride({ t: 'n', v: 1234567890123, w: '1.23E+12', z: '0.00E+00' }))
      .toBe('1234567890123');
  });
});

describe('scientificNumberOverride declines everything else', () => {
  /**
   * `null` means "leave the reader's value alone". Each case below is a class of
   * cell that a broader rewrite would have changed — the reason this is an
   * override and not a formatter.
   */

  it('declines an ordinary number, so its display format survives', () => {
    expect(scientificNumberOverride({ t: 'n', v: 12345678901, w: '12345678901' })).toBeNull();
    expect(scientificNumberOverride({ t: 'n', v: 1234.5678, w: '1234.5678' })).toBeNull();
  });

  it('declines dates, percentages and currency', () => {
    // These are numbers under the hood. Overriding them would turn a date into a
    // serial number and "15%" into "0.15".
    expect(scientificNumberOverride({ t: 'n', v: 46238, w: '04/08/2026', z: 'dd/mm/yyyy' })).toBeNull();
    expect(scientificNumberOverride({ t: 'n', v: 0.15, w: '15%', z: '0%' })).toBeNull();
    expect(scientificNumberOverride({ t: 'n', v: 5, w: '$5.00', z: '"$"#,##0.00' })).toBeNull();
  });

  it('declines a leading-zero custom format', () => {
    expect(scientificNumberOverride({ t: 'n', v: 123, w: '000123', z: '000000' })).toBeNull();
  });

  it('declines text cells, so leading zeros and letters are untouched', () => {
    expect(scientificNumberOverride({ t: 's', v: '000123' })).toBeNull();
    expect(scientificNumberOverride({ t: 's', v: 'AB-0012-X' })).toBeNull();
  });

  it('declines a text cell that literally contains scientific notation', () => {
    // Those digits are already lost in the file. Expanding would invent zeros —
    // the same corruption, one layer up.
    expect(scientificNumberOverride({ t: 's', v: '1.23E+12' })).toBeNull();
  });

  it('declines error cells, which must stay blank rather than become "#N/A"', () => {
    // The regression the review caught: a broken VLOOKUP in a barcode column
    // would otherwise export "#N/A" AS a barcode.
    expect(scientificNumberOverride({ t: 'e', v: 42, w: '#N/A' })).toBeNull();
  });

  it('declines booleans and dates', () => {
    expect(scientificNumberOverride({ t: 'b', v: true, w: 'TRUE' })).toBeNull();
    expect(scientificNumberOverride({ t: 'd', v: new Date('2026-08-04'), w: '04/08/2026' })).toBeNull();
  });

  it('declines a number with no formatted text, since there is nothing to correct', () => {
    // Nothing displayed it in scientific form, so the reader's own value stands.
    expect(scientificNumberOverride({ t: 'n', v: 1234567890123 })).toBeNull();
  });

  it('declines untyped, empty and missing cells', () => {
    expect(scientificNumberOverride(undefined)).toBeNull();
    expect(scientificNumberOverride(null)).toBeNull();
    expect(scientificNumberOverride({})).toBeNull();
    expect(scientificNumberOverride({ t: 'n', v: null, w: '1.23E+12' })).toBeNull();
    expect(scientificNumberOverride({ v: 1234567890123, w: '1.23E+12' })).toBeNull();
  });
});
