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
 * Only for COMPARISON. The original cell value is never rewritten by this.
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
  for (let n = 1; ; n++) {
    const candidate = `${base}-${n}`;
    if (!taken.has(candidate)) {
      taken.add(candidate);
      return candidate;
    }
  }
}

export type BarcodeFix = {
  rowIndex: number;
  /** The comparison key that collided. */
  key: string;
  /** The value to write into the barcode cell. */
  newValue: string;
  reason: 'duplicate' | 'cross-column';
};

/**
 * Which barcode cells to rename, and to what.
 *
 * - **Duplicate barcode:** the first row keeps the code; every later row gets
 *   `-1`, `-2`, … — mirroring how duplicate SKUs are already resolved.
 * - **Cross-column:** a barcode equal to some SKU. The SKU claims the base code,
 *   so EVERY row carrying it as a barcode is renamed, including the first.
 *
 * `groups` maps each barcode key to the rows it appears in, in row order.
 * `skuKeys` are the SKU keys. `taken` must already hold every SKU and barcode
 * key in the file (and any SKU values assigned earlier); it is updated.
 */
export function resolveBarcodes(
  groups: ReadonlyMap<string, readonly number[]>,
  skuKeys: ReadonlySet<string>,
  taken: Set<string>,
): BarcodeFix[] {
  const fixes: BarcodeFix[] = [];
  for (const [key, rows] of groups) {
    if (!key) continue;
    const claimedBySku = skuKeys.has(key);
    rows.forEach((rowIndex, i) => {
      if (!claimedBySku && i === 0) return; // the first holder keeps its code
      fixes.push({
        rowIndex,
        key,
        newValue: nextFreeSuffix(key, taken),
        reason: claimedBySku ? 'cross-column' : 'duplicate',
      });
    });
  }
  return fixes;
}
