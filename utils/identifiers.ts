/**
 * Identifier comparison and duplicate resolution for Files Validation.
 *
 * Pure functions, no React — so the rules that decide whether two SKUs or
 * barcodes are "the same" can be tested directly, and cannot drift between
 * the detection pass and the resolution pass.
 */

/**
 * Characters that change how an identifier LOOKS without changing what it IS:
 *   - combining marks (Unicode category M) — Arabic diacritics such as a kasra
 *     (U+0650) trailing a barcode like `6287013210006`, and any mark with no
 *     base character, which a renderer shows as a dotted circle;
 *   - format characters (category Cf) — zero-width spaces and joiners,
 *     left-to-right / right-to-left marks, and a stray byte-order mark;
 *   - tatweel (U+0640), the Arabic stretching character.
 *
 * Built from a code point rather than typed, so no invisible character sits in
 * this source file.
 */
const TATWEEL = String.fromCharCode(0x0640);
const INVISIBLE = new RegExp(`[\\p{M}\\p{Cf}${TATWEEL}]`, 'gu');

/**
 * The comparison key for a SKU or barcode. Two cells are duplicates exactly
 * when their keys are equal.
 *
 * Deliberately NOT changed (decision D7):
 *   - **leading zeros** — `00123` and `123` are different codes;
 *   - **visible punctuation** — SKUs legitimately use `-`, `_` and `|`, and the
 *     resolver itself appends `-1`, so stripping hyphens would make `X-1` equal
 *     `X1` and manufacture the very collisions it exists to remove;
 *   - **case** — identifiers are compared as exact text.
 *
 * Only for COMPARISON — this function rewrites nothing. The cells that
 * `resolveBarcodes` and the SKU pass identify as duplicates ARE rewritten, with
 * a `-n` suffix; every other cell keeps its original value, marks included.
 */
export const identifierKey = (value: unknown): string =>
  String(value ?? '').replace(INVISIBLE, '').trim();

/**
 * `${base}-${n}` for the smallest n ≥ 1 not already in `taken`, recorded in
 * `taken` so the next call cannot pick it too.
 *
 * Without the check, resolving `X`, `X` into `X`, `X-1` would silently create a
 * NEW duplicate whenever the file already contained an `X-1`.
 */
export function nextFreeSuffix(base: string, taken: Set<string>): string {
  // Resume where the last call for this base stopped. Restarting at 1 made k
  // duplicates of one code cost O(k^2) — ~50 million lookups for 10,000 copies.
  // Safe because `taken` only ever grows: a suffix passed over once can never
  // become free again.
  let cursors = SUFFIX_CURSORS.get(taken);
  if (!cursors) SUFFIX_CURSORS.set(taken, (cursors = new Map()));
  for (let n = cursors.get(base) ?? 1; ; n++) {
    const candidate = `${base}-${n}`;
    if (!taken.has(candidate)) {
      taken.add(candidate);
      cursors.set(base, n + 1);
      return candidate;
    }
  }
}

/** Per-`taken`-set resume points, so callers need not thread any state through. */
const SUFFIX_CURSORS = new WeakMap<Set<string>, Map<string, number>>();

export type BarcodeFix<T> = {
  /** WHERE to write — the caller's own cell reference, returned as given. */
  at: T;
  /** The comparison key that collided. */
  key: string;
  /** The value to write into that cell. */
  newValue: string;
  reason: 'duplicate' | 'cross-column';
};

/**
 * Which barcode CELLS to rename, and to what.
 *
 * - **Duplicate barcode:** the first occurrence keeps the code; every later
 *   occurrence gets `-1`, `-2`, … — mirroring how duplicate SKUs are resolved.
 * - **Cross-column:** a barcode equal to some SKU. The SKU claims the base code,
 *   so EVERY occurrence is renamed, including the first.
 *
 * Addressed by cell, not by row, and that is deliberate: a row can carry the
 * same code in two barcode columns (the Files Validation auto-mapper maps any
 * header CONTAINING "barcode", `Pack1 Barcode` included). A row-level fix
 * rewrote both cells to the same new value — manufacturing a duplicate inside
 * the row. Measured before this signature changed.
 *
 * `groups` maps each barcode key to its occurrences in file order; `T` is
 * whatever identifies a cell for the caller. `skuKeys` are the SKU keys.
 * `taken` must already hold every SKU and barcode key in the file (and any
 * SKU values assigned earlier); it is updated.
 */
export function resolveBarcodes<T>(
  groups: ReadonlyMap<string, readonly T[]>,
  skuKeys: ReadonlySet<string>,
  taken: Set<string>,
): BarcodeFix<T>[] {
  const fixes: BarcodeFix<T>[] = [];
  for (const [key, cells] of groups) {
    if (!key) continue;
    const claimedBySku = skuKeys.has(key);
    cells.forEach((at, i) => {
      if (!claimedBySku && i === 0) return; // the first holder keeps its code
      fixes.push({
        at,
        key,
        newValue: nextFreeSuffix(key, taken),
        reason: claimedBySku ? 'cross-column' : 'duplicate',
      });
    });
  }
  return fixes;
}
