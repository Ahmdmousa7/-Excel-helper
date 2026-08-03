/**
 * Reading a spreadsheet cell as the text it actually contains.
 *
 * THE BUG THIS EXISTS TO FIX
 * --------------------------
 * SheetJS gives every cell two things: `v`, the value it stores, and `w`, the
 * text Excel would *display*. Reading with `raw: false` returns `w`, which was
 * chosen so text cells keep their leading zeros ("000123" stays "000123").
 *
 * For long numbers that is a data-corruption bug. Excel's General format
 * switches to scientific at 12 digits, so a 13-digit barcode stored as a number
 * has `v = 1234567890123` and `w = "1.23457E+12"` — six significant digits. The
 * old code then "repaired" the scientific string by running `Number()` on it,
 * producing 1234570000000: a wrong barcode that still looks like a barcode.
 * Verified against a real round-tripped workbook, not a synthetic fixture.
 *
 * The true value was in `v` the whole time. So: trust `w` for presentation,
 * except when `w` is scientific, and then expand `v` at full precision.
 *
 * WHAT IS DELIBERATELY *NOT* CHANGED
 * ----------------------------------
 * `w` is still preferred for every non-scientific number, which keeps dates,
 * percentages, currency and leading-zero custom formats rendering exactly as
 * they do today. Only the broken case behaves differently. That narrowness is
 * the point: this is a correctness fix, not a reformatting pass.
 *
 * Text cells are returned verbatim — letters, punctuation, leading zeros and
 * all. A text cell whose *content* is literally "1.23E+12" is left alone rather
 * than expanded: those digits are already gone in the file, and inventing zeros
 * would be the same corruption one layer up.
 */

/** A SheetJS cell, narrowed to the fields this module reads. */
export interface SheetCell {
  /** Cell type: 'n' number · 's'/'str' text · 'b' boolean · 'e' error · 'd' date */
  t?: string;
  /** The stored value. */
  v?: string | number | boolean | Date | null;
  /** The formatted text Excel would display. */
  w?: string;
  /** The number format code. */
  z?: string;
}

/** Matches a complete scientific-notation string, e.g. `1.23457E+12`, `-4e-9`. */
const SCIENTIFIC = /^[+-]?\d+(?:\.\d+)?[eE][+-]?\d+$/;

export function isScientificNotation(s: string): boolean {
  return SCIENTIFIC.test(s.trim());
}

/**
 * A number as plain decimal digits, never exponential, without losing precision.
 *
 * `String(n)` is exact and non-exponential for everything between 1e-7 and 1e21,
 * which covers every barcode, SKU and price this app will ever see, so it is the
 * fast path. Outside that range JavaScript switches to exponent form and the
 * value has to be expanded.
 *
 * `maximumFractionDigits: 20` is load-bearing. Without it `toLocaleString`
 * defaults to **three** fraction digits, which is how the previous
 * implementation silently turned 1234.5678 into "1234.568" and 1e-7 into "0".
 */
export function plainNumberString(n: number): string {
  if (!Number.isFinite(n)) return String(n);

  const s = String(n);
  if (!/[eE]/.test(s)) return s;

  return n.toLocaleString('fullwide', {
    useGrouping: false,
    maximumFractionDigits: 20,
  });
}

/**
 * The text a cell actually holds.
 *
 * Never returns `undefined` — an absent or empty cell is the empty string, which
 * is what the grid consumers expect from `sheet_to_json`'s `defval: ""`.
 */
export function cellToText(cell: SheetCell | null | undefined): string {
  if (!cell) return '';

  const { t, v, w } = cell;

  if (v === null || v === undefined) {
    // A cell can carry formatting and no value.
    return w ?? '';
  }

  switch (t) {
    case 'n': {
      // The whole point: never let a scientific *display* string become the value.
      if (typeof w === 'string' && w !== '' && !isScientificNotation(w)) return w;
      return typeof v === 'number' ? plainNumberString(v) : String(v);
    }

    case 's':
    case 'str':
      // Verbatim. Leading zeros, letters, punctuation, spacing — all preserved.
      return String(v);

    case 'b':
      return w ?? (v ? 'TRUE' : 'FALSE');

    case 'e':
      // Error cells: `w` is the familiar "#N/A" form, `v` is a numeric code.
      return w ?? String(v);

    case 'd':
      return w ?? (v instanceof Date ? v.toISOString() : String(v));

    default:
      // Unknown type: prefer the display text, fall back to the value.
      return w ?? String(v);
  }
}
