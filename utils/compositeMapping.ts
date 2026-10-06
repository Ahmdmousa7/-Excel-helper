/**
 * Default column choices for Composite Check's mapping (Raw SKU, Cost, Name,
 * and the Composite sheet's Retail Price). Defaults only: every one stays a
 * normal dropdown the user can change, and a manual choice is kept until the
 * sheet or file it belongs to changes.
 *
 * SAFE, NOT CLEVER. The same approach as the OCR → Rewaa template auto-mapper
 * (`utils/templateMapping.ts`): headers are compared with its `normalizeHeader`
 * (case, spacing, `_`/`-` and a leading BOM ignored), an exact match first,
 * then a short ordered list of aliases, and otherwise NOTHING. Never a column
 * position, never "the column with numbers in it". When the best matching
 * alias fits two columns, nothing is chosen: the user picks.
 *
 * WHERE THE ALIASES COME FROM — evidence, not a dictionary:
 *   - the Rewaa Composite template itself (`نموذج منتج مجمع.xlsx`): Raw sheet
 *     `الرقم التعريفي للمنتج (SKU)`, `سعر التكلفة غير شامل الضريبة للوحدة الواحدة`,
 *     `اسم المادة الخام + اسم الوحدة المستخدمة`; Composite sheet `سعر البيع`;
 *   - the template auto-mapper's existing synonyms (`HEADER_SYNONYMS`): SKU =
 *     `sku`, `item code`, `product code`; name = `name`, `item name`; retail =
 *     `selling price`, `regular price`, `price`;
 *   - Rewaa's own import column for a purchase cost, `buy price`;
 *   - the names in the request: `Unit Cost`, `Material Name`.
 */
import { normalizeHeader } from './templateMapping';

export type MappingField = 'sku' | 'cost' | 'name' | 'retail';

/** Tried in this order; the first alias that matches exactly one column wins. Normalised form. */
export const MAPPING_ALIASES: Readonly<Record<MappingField, readonly string[]>> = {
  sku: ['sku', 'الرقم التعريفي للمنتج (sku)', 'product sku', 'item code', 'product code'],
  cost: ['cost', 'unit cost', 'سعر التكلفة غير شامل الضريبة للوحدة الواحدة', 'buy price'],
  name: ['name', 'material name', 'اسم المادة الخام + اسم الوحدة المستخدمة', 'item name', 'product name'],
  retail: ['retail price', 'سعر البيع', 'selling price', 'regular price', 'price'],
};

export const NO_COLUMN = -1;

/**
 * The column for one field, or -1 when there is no confident match. Columns in
 * `taken` (already chosen for another field) and from `maxCol` on are not
 * considered.
 */
export function suggestColumn(
  headers: readonly unknown[],
  field: MappingField,
  opts: { taken?: ReadonlySet<number>; maxCol?: number } = {},
): number {
  return suggestByAliases(headers, MAPPING_ALIASES[field], opts);
}

/**
 * The same rule for any ordered alias list (normalised form): the first alias
 * that matches exactly one column wins; two columns on the best matching alias
 * is ambiguous and gives -1. Used by Ready to upload for its extra fields.
 */
export function suggestByAliases(
  headers: readonly unknown[],
  aliases: readonly string[],
  opts: { taken?: ReadonlySet<number>; maxCol?: number } = {},
): number {
  return matchColumn(headers, aliases, opts).col;
}

/** `suggestByAliases`, saying WHY there is no column: none fits, or two fit equally. */
export function matchColumn(
  headers: readonly unknown[],
  aliases: readonly string[],
  opts: { taken?: ReadonlySet<number>; maxCol?: number } = {},
): { col: number; outcome: 'found' | 'missing' | 'ambiguous' } {
  const limit = Math.min(headers.length, opts.maxCol ?? headers.length);
  const normalised: string[] = [];
  for (let i = 0; i < limit; i++) normalised.push(normalizeHeader(headers[i]));
  for (const alias of aliases) {
    const hits: number[] = [];
    normalised.forEach((h, i) => {
      if (h === alias && !opts.taken?.has(i)) hits.push(i);
    });
    if (hits.length === 1) return { col: hits[0], outcome: 'found' };
    // Two columns fit the strongest alias that matches at all: ambiguous.
    // Falling through to a weaker alias would be a guess, so stop.
    if (hits.length > 1) return { col: NO_COLUMN, outcome: 'ambiguous' };
  }
  return { col: NO_COLUMN, outcome: 'missing' };
}

/** Raw sheet defaults: SKU first, then Cost, then Name — never the same column twice. */
export function suggestRawColumns(rawHeaders: readonly unknown[]): { sku: number; cost: number; name: number } {
  const taken = new Set<number>();
  const pick = (field: MappingField) => {
    const col = suggestColumn(rawHeaders, field, { taken });
    if (col !== NO_COLUMN) taken.add(col);
    return col;
  };
  const sku = pick('sku');
  const cost = pick('cost');
  const name = pick('name');
  return { sku, cost, name };
}

/**
 * Composite sheet default for Retail Price. Only among the fixed columns: the
 * validated export ignores a Retail Price column placed among the ingredient
 * pairs, so suggesting one there would be a default that cannot work.
 */
export const suggestRetailColumn = (headers: readonly unknown[], fixedColCount: number): number =>
  suggestColumn(headers, 'retail', { maxCol: fixedColCount });

/** A mapping choice and where it came from. */
export interface MappingChoice {
  col: number;
  source: 'auto' | 'manual';
}

export const autoChoice = (col: number): MappingChoice => ({ col, source: 'auto' });
export const manualChoice = (col: number): MappingChoice => ({ col, source: 'manual' });

/**
 * The choice after the columns it refers to may have changed.
 *
 * - `sourceChanged` (another file, another sheet): the old choice belongs to
 *   columns that are gone — take the new default, even over a manual choice.
 * - otherwise a MANUAL choice stands, as long as its column still exists;
 *   an automatic one is simply recomputed.
 */
export function nextChoice(current: MappingChoice, suggested: number, sourceChanged: boolean, columnCount: number): MappingChoice {
  if (sourceChanged) return autoChoice(suggested);
  if (current.source === 'manual' && current.col < columnCount) return current;
  return autoChoice(suggested);
}
