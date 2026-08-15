/**
 * The business rule for an ingredient quantity in Composite Check.
 *
 * **A quantity must be strictly greater than zero.** Zero is invalid, negative is
 * invalid, only positive is valid.
 *
 * Extracted from `CompositeTab` so the numeric edges can be checked directly.
 * They are the whole difficulty here — `Number("0.0")`, `Number("-0")`,
 * `Number("1e-3")`, `Number("Infinity")` and `typeof NaN === 'number'` all behave
 * in ways that a hand-rolled check gets wrong, and every one of them reaches this
 * function as a string out of a spreadsheet cell.
 */

export type QuantityVerdict =
  /** A usable quantity: a finite number greater than zero. */
  | 'ok'
  /** Parses as a number, and that number is zero. */
  | 'zero'
  /** Parses as a number, and that number is below zero. */
  | 'negative'
  /** Not a number at all — text, a symbol, or a non-finite value. */
  | 'non-numeric';

/**
 * Classify one quantity cell.
 *
 * BLANK is not handled here. An empty quantity is already reported as
 * "Missing Qty for Ingredient" earlier in the validation pass, where the SKU
 * beside it is in scope and the message can name it; classifying it again here
 * would produce two errors for one cell. Callers guard with a truthiness check,
 * and a blank reaching this function anyway is reported as `non-numeric` rather
 * than silently passing.
 */
export function classifyQuantity(raw: unknown): QuantityVerdict {
  // Only a string or a number is a candidate. Coercing anything else with
  // `String(raw)` first looks harmless and is not: `String([5])` is "5", so an
  // array cell would have been accepted as the quantity 5. A cell holding an
  // array is a parsing accident, not a five.
  let n: number;
  if (typeof raw === 'number') {
    n = raw;
  } else if (typeof raw === 'string') {
    const text = raw.trim();
    if (text === '') return 'non-numeric';
    // A PLAIN DECIMAL only. `Number()` also accepts JavaScript's hex, octal and
    // binary literals, so "0x10" arrived as the quantity 16 — a spreadsheet cell
    // reading 0x10 is text that someone needs to look at, not sixteen of
    // something. Excel agrees: it stores that as text, not as a number.
    if (!/^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(text)) return 'non-numeric';
    n = Number(text);
  } else {
    return 'non-numeric';
  }

  // `Number.isFinite` rather than `!isNaN`. The old inline check used `isNaN`,
  // which accepts Infinity — `Number("Infinity")` is not NaN, so "Infinity" in a
  // quantity column passed as a valid positive number. It is not a quantity.
  if (!Number.isFinite(n)) return 'non-numeric';

  // Ordered so that `-0` — which `Number("-0")` produces and which compares
  // equal to 0 — is reported as zero rather than negative. Same cell content,
  // same message either way, but the ordering makes that a decision rather than
  // an accident.
  if (n === 0) return 'zero';
  if (n < 0) return 'negative';
  return 'ok';
}
