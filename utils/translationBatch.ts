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
  /** The reply cannot be trusted at all. Nothing from it may be used. */
  | { ok: false; received: number }
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
  if (!Array.isArray(raw) || raw.length !== expected) {
    return { ok: false, received: Array.isArray(raw) ? raw.length : 0 };
  }

  // Normalised here so callers cannot disagree about what counts as a result.
  // A non-string (a number, an object, null) is not a translation, and
  // whitespace is not either.
  const translations = raw.map((r) => (typeof r === 'string' ? r.trim() : ''));
  const usable = translations.reduce((n, t) => (t ? n + 1 : n), 0);
  return { ok: true, translations, usable };
}
