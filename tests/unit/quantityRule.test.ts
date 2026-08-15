import { describe, it, expect } from 'vitest';
import { classifyQuantity } from '../../utils/quantityRule';

/**
 * The rule: an ingredient quantity must be STRICTLY greater than zero.
 *
 * These are unit tests rather than only e2e because the difficulty is entirely
 * numeric-edge shaped, and every value below arrives as a string out of a
 * spreadsheet cell. `Number("0.0")`, `Number("-0")`, `Number("1e-3")` and
 * `Number("Infinity")` each behave in a way a hand-rolled check gets wrong.
 */
describe('classifyQuantity', () => {
  describe('positive values are the only valid ones', () => {
    it('accepts whole numbers', () => {
      for (const v of ['1', '2', '10', '9999']) {
        expect(classifyQuantity(v), v).toBe('ok');
      }
    });

    it('accepts decimals, including very small ones', () => {
      // A recipe using 0.001 kg of something is a real quantity, and rounding it
      // to zero would be the tool inventing an error.
      for (const v of ['0.5', '1.5', '0.001', '0.0001']) {
        expect(classifyQuantity(v), v).toBe('ok');
      }
    });

    it('accepts scientific notation, which Excel produces on its own', () => {
      // `1e-3` is 0.001 — positive. The General format switches to this notation
      // without being asked, so it reaches validation whether or not a user typed
      // it that way.
      expect(classifyQuantity('1e-3')).toBe('ok');
      expect(classifyQuantity('2E2')).toBe('ok');
    });

    it('accepts a number that arrives as a number rather than a string', () => {
      // `raw: true` parsing hands over real numbers, not text.
      expect(classifyQuantity(3)).toBe('ok');
      expect(classifyQuantity(0.25)).toBe('ok');
    });

    it('ignores surrounding whitespace', () => {
      expect(classifyQuantity('  2  ')).toBe('ok');
    });
  });

  describe('zero is invalid', () => {
    it('rejects plain zero', () => {
      expect(classifyQuantity('0')).toBe('zero');
      expect(classifyQuantity(0)).toBe('zero');
    });

    it('rejects zero written as a decimal', () => {
      // A string comparison against "0" would miss every one of these.
      for (const v of ['0.0', '0.00', '00', '0.000']) {
        expect(classifyQuantity(v), v).toBe('zero');
      }
    });

    it('reports negative zero as zero, not negative', () => {
      // `Number("-0")` is -0, which `=== 0` is true for and `< 0` is false for.
      // The ordering of the checks decides this rather than leaving it to chance.
      expect(classifyQuantity('-0')).toBe('zero');
      expect(classifyQuantity('-0.0')).toBe('zero');
    });
  });

  describe('negative is invalid', () => {
    it('rejects negative integers', () => {
      for (const v of ['-1', '-5', '-100']) {
        expect(classifyQuantity(v), v).toBe('negative');
      }
    });

    it('rejects negative decimals', () => {
      for (const v of ['-0.5', '-1.5', '-0.001']) {
        expect(classifyQuantity(v), v).toBe('negative');
      }
    });

    it('rejects a negative that arrives as a number', () => {
      expect(classifyQuantity(-2)).toBe('negative');
      expect(classifyQuantity(-0.25)).toBe('negative');
    });

    it('rejects negative scientific notation', () => {
      expect(classifyQuantity('-1e2')).toBe('negative');
    });
  });

  describe('anything that is not a finite number', () => {
    it('rejects text', () => {
      for (const v of ['abc', 'two', 'N/A', '#REF!', '1/2', '5 kg']) {
        expect(classifyQuantity(v), v).toBe('non-numeric');
      }
    });

    it('rejects hex, octal and binary literals', () => {
      // `Number("0x10")` is 16, so a cell reading 0x10 was accepted as sixteen of
      // something. Excel stores that as text, not as a number, and so should this.
      for (const v of ['0x10', '0X1F', '0b101', '0o17']) {
        expect(classifyQuantity(v), v).toBe('non-numeric');
      }
    });

    it('rejects a very long digit run promptly', () => {
      // Guards the regex shape, not the verdict. An ambiguous pattern
      // (`\d+\.?\d*`) backtracks quadratically here; 100k digits plus one letter
      // is a hang rather than a wrong answer, and a spreadsheet cell is exactly
      // where a string that long comes from.
      const started = performance.now();
      expect(classifyQuantity('9'.repeat(100_000) + 'x')).toBe('non-numeric');
      expect(performance.now() - started).toBeLessThan(1_000);
    });

    it('rejects thousands separators rather than guessing', () => {
      // `Number("1,000")` is NaN anyway; pinned so a future "be helpful" parse
      // does not silently turn "1,000" into 1.
      expect(classifyQuantity('1,000')).toBe('non-numeric');
    });

    it('rejects NaN and Infinity', () => {
      // `typeof NaN === 'number'`, and `isNaN(Number("Infinity"))` is FALSE — so
      // the previous inline check let "Infinity" through as a valid positive
      // quantity. It is not a quantity.
      expect(classifyQuantity('Infinity')).toBe('non-numeric');
      expect(classifyQuantity('-Infinity')).toBe('non-numeric');
      expect(classifyQuantity(NaN)).toBe('non-numeric');
      expect(classifyQuantity(Infinity)).toBe('non-numeric');
    });

    it('rejects blank without throwing', () => {
      // Blank is the caller's concern — it is already reported as a Missing Qty
      // with the ingredient SKU named. Reaching here anyway must not pass.
      for (const v of ['', '   ', null, undefined]) {
        expect(classifyQuantity(v), String(v)).toBe('non-numeric');
      }
    });

    it('rejects objects and arrays rather than stringifying them', () => {
      expect(classifyQuantity({})).toBe('non-numeric');
      expect(classifyQuantity({ qty: 5 })).toBe('non-numeric');
      // `Number([5])` is 5, which would otherwise sneak through as valid.
      expect(classifyQuantity([5])).toBe('non-numeric');
    });
  });

  it('never returns ok for anything at or below zero', () => {
    // The rule in one assertion, over the whole set above.
    const notPositive = ['0', '0.0', '-0', '-1', '-0.5', '-1e2', 'abc', '', 'Infinity'];
    for (const v of notPositive) {
      expect(classifyQuantity(v), `${v} must not be accepted`).not.toBe('ok');
    }
  });
});
