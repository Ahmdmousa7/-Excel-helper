/**
 * The decision a translation batch's reply has to survive before any of it is
 * written to a row.
 *
 * Extracted from `TranslateTab` for one reason: it is the highest-consequence
 * branch in that component and the only one whose regression is *invisible*.
 * Reverting the length check to a bare `forEach` leaves every test green and
 * produces a workbook that looks correct — plausible translations filed against
 * the wrong products. Inside the component it could only be reached by driving
 * the whole UI; here it is four assertions.
 */

export type BatchAlignment =
  /**
   * The reply cannot be trusted at all. Nothing from it may be used.
   *
   * `received` is null when the reply was not an array — distinct from an array
   * of length 0. Both are unusable, but they are different failures: `[]` is a
   * model that answered with nothing, while a non-array is a model that answered
   * with the wrong SHAPE (an object, a bare string, a number), and the log used
   * to report both as "returned 0 results" and send the reader looking for an
   * empty response that never happened.
   */
  | { ok: false; received: number | null }
  /** One result per input. `translations[i]` belongs to `items[i]`. */
  | { ok: true; translations: string[]; usable: number };

/**
 * Decide whether a batch reply lines up with what was sent.
 *
 * The model is not contractually obliged to return one result per input — the
 * reply is `JSON.parse(response.text)` with no shape or length check — and a
 * model that drops or merges one item returns a SHORTER array. Positional
 * mapping is only safe when the lengths match: with a gap, every result after it
 * is filed against the wrong source row. That is silent corruption, so a
 * mismatch discards the whole batch rather than guessing at the alignment.
 *
 * `usable` counts results that actually contain something. `translateBatch` does
 * not always throw on failure: an unparseable reply makes it return
 * `items.map(() => "")`, and an empty reply parses to `[]`. Writing those blanks
 * into the translation map made them indistinguishable from real translations —
 * rows showed "Translated" beside an empty cell, and the batch was credited in
 * full.
 */
export function alignBatchResults(raw: unknown, expected: number): BatchAlignment {
  if (!Array.isArray(raw)) return { ok: false, received: null };
  if (raw.length !== expected) return { ok: false, received: raw.length };

  const translations = raw.map(normaliseResult);
  const usable = translations.reduce((n, t) => (t ? n + 1 : n), 0);
  return { ok: true, translations, usable };
}

/**
 * One element of a reply, as text, or `''` if it is not a translation.
 *
 * Normalised here so callers cannot disagree about what counts as a result.
 *
 * A FINITE NUMBER counts. JSON has a number type and models use it: ask for a
 * translation of the item "500" and a reply of `500` rather than `"500"` is
 * correct, not a failure. Rejecting it marked the row untranslated and could
 * force a `PARTIAL_` export of a file that was actually complete — plausible for
 * numeric product codes, which this app is full of.
 *
 * `null`, objects, arrays, booleans and NaN/Infinity do NOT count. The reason the
 * check exists at all is that `String(null)` writes the text "null" into a
 * product column and `String({})` writes "[object Object]" — a number has no such
 * problem, which is exactly what separates it from the rest.
 */
function normaliseResult(r: unknown): string {
  if (typeof r === 'string') return r.trim();
  // `typeof NaN === 'number'`, and `isFinite` also rejects ±Infinity — both of
  // which stringify to words, not numbers.
  if (typeof r === 'number' && Number.isFinite(r)) return String(r);
  return '';
}
