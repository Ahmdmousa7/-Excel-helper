/**
 * Recovering a number that Excel only *displays* in scientific notation.
 *
 * THE BUG THIS EXISTS TO FIX
 * --------------------------
 * SheetJS gives every cell two things: `v`, the value it stores, and `w`, the
 * text Excel would display. Reading a sheet with `raw: false` returns `w`, which
 * was chosen so text cells keep their leading zeros ("000123" stays "000123").
 *
 * For long numbers that is data corruption. Excel's General format switches to
 * scientific at 12 digits, so a 13-digit barcode stored as a number has
 * `v = 1234567890123` and `w = "1.23457E+12"` — six significant digits. The old
 * code then "repaired" the scientific string by running `Number()` on it,
 * producing 1234570000000: a wrong barcode that still looks like a barcode.
 * Verified against a real round-tripped workbook, and pinned by the committed
 * fixture in tests/fixtures/.
 *
 * The true value was in `v` the whole time.
 *
 * WHY THIS IS AN *OVERRIDE* AND NOT A FORMATTER
 * ---------------------------------------------
 * An earlier version of this module exported `cellToText(cell)` and
 * `getSheetData` used it for every cell. That was too broad, and the review was
 * right to call it: it silently changed three other classes of cell. Error cells
 * went from `""` (SheetJS never formats `t:'e'`, it writes `defval`) to the
 * literal `"#N/A"` — so a broken VLOOKUP in a barcode column would have started
 * exporting `#N/A` *as a barcode*, which is the same "wrong value that looks like
 * a value" this fix exists to remove. Text cells carrying a display format lost
 * it, and untyped cells started yielding `String(v)` instead of `defval`.
 *
 * So this module answers one narrow question — *does this cell need correcting,
 * and to what?* — and `getSheetData` keeps SheetJS's own value for every cell
 * where the answer is no. "Only the broken case behaves differently" is then
 * provable by inspection rather than asserted in a comment.
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
 * Expand JavaScript's exponential form into plain digits, by moving the decimal
 * point. Pure string work — see `plainNumberString` for why this is not `Intl`.
 *
 * Returns the input unchanged if it is not in exponential form.
 */
function expandExponential(s: string): string {
  const m = /^([+-]?)(\d+)(?:\.(\d+))?[eE]([+-]?\d+)$/.exec(s);
  if (!m) return s;

  const [, sign, intPart, fracPart = '', expStr] = m;
  const digits = intPart + fracPart;
  // Where the decimal point lands once the exponent is applied.
  const point = intPart.length + Number(expStr);

  if (point <= 0) return `${sign}0.${'0'.repeat(-point)}${digits}`;
  if (point >= digits.length) return sign + digits + '0'.repeat(point - digits.length);
  return `${sign}${digits.slice(0, point)}.${digits.slice(point)}`;
}

/**
 * A number as plain decimal digits, never exponential, without losing precision.
 *
 * `String(n)` is exact and non-exponential for everything between 1e-7 and 1e21,
 * which covers every barcode, SKU and price this app will see, so it is the fast
 * path. Outside that range JavaScript switches to exponent form and the value has
 * to be expanded.
 *
 * NOT `toLocaleString('fullwide', …)`, which is what both this function and the
 * code it replaced used to do. `'fullwide'` is a structurally valid but
 * *unavailable* language subtag, so `ResolveLocale` silently falls back to the
 * runtime's default locale — and to its default numbering system. On a browser
 * set to `ar-EG` or `ar-SA` that resolves to `arab`, and the "plain digits" this
 * function promises come back as Arabic-Indic numerals:
 *
 *     (1e21).toLocaleString('fullwide', …)  ->  "١٠٠٠٠٠٠٠٠٠٠٠٠٠٠٠٠٠٠٠٠٠"
 *
 * Measured, not theorised. This app ships a full Arabic translation layer, so
 * that is a live configuration, and a barcode in Arabic-Indic digits would fail
 * every match, export and scan downstream. `maximumFractionDigits` had a similar
 * trap — it defaults to **three**, which is how the old code turned 1234.5678
 * into "1234.568" and 1e-7 into "0".
 *
 * Expanding the exponent by hand has neither problem: no locale, no numbering
 * system, no rounding, and the digits come from the double itself.
 */
export function plainNumberString(n: number): string {
  if (!Number.isFinite(n)) return String(n);

  const s = String(n);
  if (!/[eE]/.test(s)) return s;

  return expandExponential(s);
}

/**
 * The corrected text for a cell whose displayed value has lost digits, or `null`
 * when the cell needs no correction.
 *
 * `null` means "leave whatever the reader produced alone", which is what keeps
 * this fix from touching dates, percentages, currency, leading-zero formats,
 * error cells, text cells and blanks.
 *
 * Only one shape qualifies: a **number** whose formatted text is scientific
 * notation. A *text* cell whose content is literally "1.23E+12" is deliberately
 * left alone — those digits are already gone in the file, and expanding them
 * would invent zeros, which is the same corruption one layer up.
 *
 * A deliberate limit: this cannot tell Excel's automatic General-format switch at
 * 12 digits (the bug) from a column someone formatted `0.00E+00` on purpose (a
 * choice). Both are corrected, and that is the intended answer for this app —
 * these sheets carry barcodes, SKUs and prices, the request that prompted the fix
 * was "I need scientific notation to be a number normally, as is", and a
 * scientific-formatted barcode column is far more likely to be Excel helping than
 * a user choosing. Distinguishing them would mean reading `cell.z`, and a cell
 * whose format is General carries no `z` at all — so the signal is absent exactly
 * where it would be needed. If a genuine scientific-notation use case turns up,
 * that is the trade to revisit.
 */
export function scientificNumberOverride(cell: SheetCell | null | undefined): string | null {
  if (!cell || cell.t !== 'n') return null;
  if (typeof cell.v !== 'number') return null;
  if (typeof cell.w !== 'string' || !isScientificNotation(cell.w)) return null;

  return plainNumberString(cell.v);
}
