import { describe, it, expect } from 'vitest';
import {
  isScientificNotation,
  plainNumberString,
  cellToText,
} from '../../utils/cellText';

/**
 * The values in these tests are not invented. They are what SheetJS actually
 * produces for a workbook written and read back with plain JS numbers:
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
    // The case that would be catastrophic to misfire on: a real SKU.
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

describe('cellToText — the corruption this fixes', () => {
  it('recovers the true barcode instead of expanding the scientific display', () => {
    // Exactly what SheetJS parsed from a real round-tripped workbook.
    expect(cellToText({ t: 'n', v: 1234567890123, w: '1.23457E+12' }))
      .toBe('1234567890123');
    // The old behaviour produced this, which is a plausible-looking wrong barcode.
    expect(cellToText({ t: 'n', v: 1234567890123, w: '1.23457E+12' }))
      .not.toBe('1234570000000');
  });

  it('recovers a 16-digit number the display had truncated to six digits', () => {
    expect(cellToText({ t: 'n', v: 1234567890123456, w: '1.23457E+15' }))
      .toBe('1234567890123456');
  });

  it('handles an explicitly scientific-formatted cell', () => {
    expect(cellToText({ t: 'n', v: 1234567890123, w: '1.23E+12', z: '0.00E+00' }))
      .toBe('1234567890123');
  });
});

describe('cellToText — what must keep working exactly as before', () => {
  it('preserves leading zeros in text cells', () => {
    expect(cellToText({ t: 's', v: '000123' })).toBe('000123');
    expect(cellToText({ t: 's', v: '0' })).toBe('0');
  });

  it('preserves letters and punctuation in SKUs', () => {
    expect(cellToText({ t: 's', v: 'AB-0012-X' })).toBe('AB-0012-X');
    expect(cellToText({ t: 's', v: 'sku/with spaces & symbols' }))
      .toBe('sku/with spaces & symbols');
  });

  it('leaves a text cell that literally contains scientific notation alone', () => {
    // Those digits are already lost in the file. Expanding it would invent
    // zeros — the same corruption, one layer up.
    expect(cellToText({ t: 's', v: '1.23E+12' })).toBe('1.23E+12');
  });

  it('keeps the formatted display for ordinary numbers', () => {
    expect(cellToText({ t: 'n', v: 12345678901, w: '12345678901' })).toBe('12345678901');
    expect(cellToText({ t: 'n', v: 1234.5678, w: '1234.5678' })).toBe('1234.5678');
  });

  it('keeps dates, percentages and currency rendering as they do today', () => {
    // These come through `w`, and `w` is still preferred whenever it is not
    // scientific — so this fix does not silently reformat anything.
    expect(cellToText({ t: 'n', v: 46238, w: '04/08/2026', z: 'dd/mm/yyyy' }))
      .toBe('04/08/2026');
    expect(cellToText({ t: 'n', v: 0.15, w: '15%', z: '0%' })).toBe('15%');
    expect(cellToText({ t: 'n', v: 5, w: '$5.00', z: '"$"#,##0.00' })).toBe('$5.00');
    // A leading-zero custom format, the other way leading zeros can appear.
    expect(cellToText({ t: 'n', v: 123, w: '000123', z: '000000' })).toBe('000123');
  });

  it('falls back to the raw value when there is no formatted text', () => {
    expect(cellToText({ t: 'n', v: 1234567890123 })).toBe('1234567890123');
  });

  it('handles booleans, errors and dates', () => {
    expect(cellToText({ t: 'b', v: true })).toBe('TRUE');
    expect(cellToText({ t: 'b', v: false })).toBe('FALSE');
    expect(cellToText({ t: 'e', v: 42, w: '#N/A' })).toBe('#N/A');
    expect(cellToText({ t: 'd', v: new Date('2026-08-04T00:00:00Z'), w: '04/08/2026' }))
      .toBe('04/08/2026');
  });

  it('returns empty string for an absent or valueless cell', () => {
    expect(cellToText(undefined)).toBe('');
    expect(cellToText(null)).toBe('');
    expect(cellToText({})).toBe('');
    expect(cellToText({ t: 'n', v: null })).toBe('');
  });

  it('does not turn a zero into an empty string', () => {
    // `v` of 0 is falsy; a naive guard would drop it.
    expect(cellToText({ t: 'n', v: 0, w: '0' })).toBe('0');
    expect(cellToText({ t: 'n', v: 0 })).toBe('0');
  });
});
