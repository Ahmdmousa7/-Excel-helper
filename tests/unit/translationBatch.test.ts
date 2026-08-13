import { describe, it, expect } from 'vitest';
import { alignBatchResults } from '../../utils/translationBatch';

/**
 * The branch these cover is the one whose failure is invisible.
 *
 * A translation batch is mapped onto its source rows by POSITION. If the model
 * returns 19 results for 20 items, a naive `forEach` files result 19 against
 * item 20 and every result after the gap lands on the wrong product — plausible
 * Arabic text against the wrong SKU, in a file that looks finished. Nothing in
 * the export says so, which is why the guard has to be checked here rather than
 * trusted.
 */
describe('alignBatchResults', () => {
  const three = ['Blue Shirt', 'Red Trousers', 'Green Hat'];

  describe('rejects anything it cannot map by position', () => {
    it('discards a SHORT reply rather than shifting results onto wrong rows', () => {
      const r = alignBatchResults(['قميص أزرق', 'بنطال أحمر'], three.length);
      expect(r.ok).toBe(false);
      // The count is reported so the log can say what actually came back.
      expect(r.ok === false && r.received).toBe(2);
    });

    it('discards a LONG reply too — an extra item is the same unknown alignment', () => {
      const r = alignBatchResults(['a', 'b', 'c', 'd'], three.length);
      expect(r.ok).toBe(false);
    });

    it('discards an empty array, which is what an empty model reply parses to', () => {
      const r = alignBatchResults([], three.length);
      expect(r.ok).toBe(false);
      expect(r.ok === false && r.received).toBe(0);
    });

    it('discards a non-array without throwing', () => {
      // `JSON.parse` of a malformed reply can produce any of these.
      for (const bad of [null, undefined, 'text', 42, {}, { 0: 'a', length: 3 }]) {
        const r = alignBatchResults(bad, three.length);
        expect(r.ok, String(bad)).toBe(false);
        expect(r.ok === false && r.received, String(bad)).toBe(0);
      }
    });
  });

  describe('accepts a reply that lines up, and says how much of it is real', () => {
    it('keeps order, so translations[i] belongs to items[i]', () => {
      const r = alignBatchResults(['قميص أزرق', 'بنطال أحمر', 'قبعة خضراء'], three.length);
      expect(r.ok).toBe(true);
      expect(r.ok === true && r.translations).toEqual(['قميص أزرق', 'بنطال أحمر', 'قبعة خضراء']);
      expect(r.ok === true && r.usable).toBe(3);
    });

    it('does not count blanks as translated', () => {
      // The silent-failure shape: `translateBatch` returns `items.map(() => "")`
      // when the reply will not parse. Counting those credited the batch in full
      // and rows showed "Translated" beside an empty cell.
      const r = alignBatchResults(['قميص أزرق', '', 'قبعة خضراء'], three.length);
      expect(r.ok === true && r.usable).toBe(2);
      expect(r.ok === true && r.translations[1]).toBe('');
    });

    it('treats whitespace-only as blank', () => {
      const r = alignBatchResults(['  ', '\n\t', 'قبعة خضراء'], three.length);
      expect(r.ok === true && r.usable).toBe(1);
    });

    it('trims, so a padded result is not written with its padding', () => {
      const r = alignBatchResults(['  قميص أزرق  ', 'x', 'y'], three.length);
      expect(r.ok === true && r.translations[0]).toBe('قميص أزرق');
    });

    it('treats a non-string element as blank rather than stringifying it', () => {
      // `String(null)` would write the text "null" into a product name column.
      const r = alignBatchResults([null, 42, { t: 'x' }], three.length);
      expect(r.ok === true && r.usable).toBe(0);
      expect(r.ok === true && r.translations).toEqual(['', '', '']);
    });

    it('handles the whole batch coming back blank without claiming success', () => {
      const r = alignBatchResults(['', '', ''], three.length);
      expect(r.ok).toBe(true); // the shape is fine…
      expect(r.ok === true && r.usable).toBe(0); // …but nothing was translated
    });
  });

  it('accepts a single-item batch, the boundary the loop hits on the last chunk', () => {
    const r = alignBatchResults(['قميص أزرق'], 1);
    expect(r.ok === true && r.usable).toBe(1);
  });
});
