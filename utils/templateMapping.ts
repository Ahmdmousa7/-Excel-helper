/**
 * Mapping OCR output onto an uploaded import template (Rewaa Simple / Variable).
 *
 * One module, used by both the auto-mapper and the exporter, so the two can
 * never disagree about which extracted column feeds which template column.
 * They did disagree in an earlier implementation elsewhere: one side lowercased
 * header keys and the other did not, so `Regular price` was found by the mapper
 * and missed by the checker, and correct rows were reported as mismatches.
 * Normalising in exactly one place makes that class of bug unrepresentable.
 *
 * Pure functions, no React, and no RUNTIME SheetJS dependency (the one parser
 * takes the library as a parameter) — testable against the real templates.
 */

import type * as XLSXNS from 'xlsx';

export type TemplateRow = Record<string, unknown>;
export type Mapping = Record<string, string>;

/**
 * Own-property access only. The lookup tables below are plain objects, and a
 * template header is arbitrary user text: without these, a column named
 * `constructor` resolved to `Object` itself and crashed the mapper, and one
 * named `__proto__` was silently DROPPED from the output because assigning to
 * it sets the prototype instead of a key. Both measured before the fix.
 */
const hasOwn = (obj: object, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(obj, key);

const getOwn = <T,>(obj: Readonly<Record<string, T>>, key: string): T | undefined =>
  hasOwn(obj, key) ? obj[key] : undefined;

const setOwn = (obj: Record<string, unknown>, key: string, value: unknown): void => {
  Object.defineProperty(obj, key, { value, enumerable: true, writable: true, configurable: true });
};

/**
 * Compare headers by meaning, not by spelling: case, surrounding whitespace,
 * runs of spaces, `_`/`-` separators and a leading UTF-8 BOM are all ignored.
 *
 * The BOM matters in practice: a CSV saved by Excel starts with U+FEFF, and
 * SheetJS can hand it through on the first header, so `Product Name` would
 * otherwise fail to match `\uFEFFProduct Name` and silently map to nothing.
 */
export const normalizeHeader = (header: unknown): string =>
  String(header ?? '')
    .replace(/^\uFEFF/, '')
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Other names the AI uses for a template column, keyed by the NORMALISED
 * template header. Tried only after an exact match fails, and in the order
 * listed, so a row that has both `Retail Price` and `Price` maps the former.
 *
 * Deliberately short. A synonym that is sometimes wrong is worse than a blank
 * the user can see and fix in the mapping panel. Note that `price` is listed
 * for Retail Price: right for menus, which is what this export is for, but on
 * an INVOICE extraction a bare `price` is usually the purchase cost — check the
 * mapping panel after extracting an invoice.
 */
export const HEADER_SYNONYMS: Readonly<Record<string, readonly string[]>> = {
  'product name': ['name', 'item name'],
  'retail price': ['regular price', 'selling price', 'price'],
  'product sku': ['sku', 'item code', 'product code'],
  'variant sku': ['sku', 'item code', 'product code'],
  'barcode': ['ean', 'upc', 'gtin'],
  'variant barcode': ['barcode', 'ean', 'upc', 'gtin'],
  'description': ['desc', 'details'],
  'variant description': ['description'],
};

/**
 * Values a Rewaa import expects when the extraction supplied nothing, read off
 * the data rows of the real templates (2026-09-28) rather than assumed.
 *
 * `Retail Price` is deliberately ABSENT. Every other price defaults to 0, but a
 * missing retail price exported as 0 imports as a free product, and it is the
 * one number the extraction exists to capture. Blank is visible; 0 is not.
 *
 * `Enable stock management` is `no` — and this one CONTRADICTS the template.
 * Both templates' own spec row says `list yes no Default yes`, meaning Rewaa's
 * importer treats a blank as `yes`. Every sample data row says `no`, and the
 * product owner explicitly asked for `no`. So `no` is written out on purpose,
 * overriding Rewaa's own default rather than leaving the cell blank. Do not
 * "fix" this to match the spec row without asking. Since 2026-09-29 it is also
 * ENFORCED — an extracted `yes` is overwritten too; see REWAA_FIXED_VALUES.
 */
const PACK_DEFAULTS: Record<string, string | number> = {};
for (const n of [1, 2, 3]) {
  PACK_DEFAULTS[`pack${n} def retail price`] = 0;
  PACK_DEFAULTS[`pack${n} def buy price`] = 0;
  PACK_DEFAULTS[`pack${n} sellable`] = 'yes';
  PACK_DEFAULTS[`pack${n} purchasable`] = 'yes';
}

export const TEMPLATE_DEFAULTS: Readonly<Record<string, string | number>> = {
  'sellable': 'yes',
  'purchasable': 'yes',
  'enable stock management': 'no',
  'weighted': 'no',
  'tracked by batch': 'no',
  'tracked by serial': 'no',
  'wholesale price': 0,
  'cost': 0,
  'buy price': 0,
  ...PACK_DEFAULTS,
};

export const defaultFor = (templateHeader: unknown): string | number | undefined =>
  getOwn(TEMPLATE_DEFAULTS, normalizeHeader(templateHeader));

/** The extracted column that feeds `templateHeader`, or undefined if none does. */
export function resolveSourceKey(
  templateHeader: unknown,
  available: readonly string[],
): string | undefined {
  const target = normalizeHeader(templateHeader);
  if (!target) return undefined;

  const byNorm = new Map<string, string>();
  for (const key of available) {
    const n = normalizeHeader(key);
    if (n && !byNorm.has(n)) byNorm.set(n, key); // first spelling wins
  }

  const exact = byNorm.get(target);
  if (exact !== undefined) return exact;

  for (const synonym of getOwn(HEADER_SYNONYMS, target) ?? []) {
    const hit = byNorm.get(synonym);
    if (hit !== undefined) return hit;
  }
  return undefined;
}

/**
 * Fill in mapping entries that are still ABSENT. An entry that is present —
 * including `''`, which is what the panel's "-- Ignore --" stores — is the
 * user's decision and is never overwritten. Headers with no match stay absent,
 * so a later extraction can still fill them.
 */
export function autoMap(
  templateHeaders: readonly unknown[],
  available: readonly string[],
  existing: Mapping = {},
): Mapping {
  const out: Mapping = {};
  for (const k of Object.keys(existing)) setOwn(out, k, existing[k]);
  for (const h of templateHeaders) {
    const key = String(h);
    if (hasOwn(out, key)) continue;
    const src = resolveSourceKey(h, available);
    if (src !== undefined) setOwn(out, key, src);
  }
  return out;
}

/**
 * Re-map after a NEW extraction, keeping what is still valid.
 *
 * `autoMap` alone never overwrites, which protects the user's choices — but it
 * also froze auto-filled guesses. Extraction 1 names the column `Regular price`
 * and `Retail Price` maps to it; extraction 2 calls it `Price`; the stale entry
 * survived and the new prices exported BLANK, silently. Measured before the fix.
 *
 * So: an entry pointing at a column that does not exist in THIS extraction can
 * only ever export blank, and is dropped and re-resolved. Kept untouched:
 *   - an explicit `''` — the user's "-- Ignore --";
 *   - any entry whose column still exists, whoever chose it.
 */
export function refreshMapping(
  templateHeaders: readonly unknown[],
  available: readonly string[],
  existing: Mapping,
): Mapping {
  const present = new Set(available);
  const kept: Mapping = {};
  for (const k of Object.keys(existing)) {
    const v = existing[k];
    if (v === '' || present.has(v)) setOwn(kept, k, v);
  }
  return autoMap(templateHeaders, available, kept);
}

const isBlank = (v: unknown): boolean =>
  v === undefined || v === null || (typeof v === 'string' && v.trim() === '');

/**
 * Rows reshaped to exactly the template's columns, in the template's order.
 *
 * Uses the mapping AS GIVEN — no hidden resolution here — so the file matches
 * what the mapping panel shows. A column with no source, or whose source is
 * blank for this row, gets the template default when there is one and `''`
 * otherwise. A default never overrides a value the extraction produced: an
 * extracted `Sellable: no` stays `no`.
 */
export function mapRowsToTemplate(
  rows: readonly TemplateRow[],
  mapping: Mapping,
  templateHeaders: readonly unknown[],
): TemplateRow[] {
  // Defaults are Rewaa's, so they apply to Rewaa templates only. The mapping
  // panel accepts ANY template — a Salla, Zid or custom sheet with a column
  // called `Sellable` or `Cost` must not silently receive `yes` / `0` it was
  // never designed for. Other templates keep the old behaviour: blank.
  const applyDefaults = isRewaaTemplate(templateHeaders);
  const variantNameKey = applyDefaults ? headerFor(templateHeaders, 'variant name') : undefined;
  return rows.map((row) => {
    const out: TemplateRow = {};
    for (const h of templateHeaders) {
      const key = String(h);
      const src = getOwn(mapping, key);
      let value = src ? getOwn(row, src) : undefined;
      if (applyDefaults && YES_NO_COLUMNS.has(normalizeHeader(key)) && !isBlank(value)) {
        // An out-of-list value would be rejected by the importer, so it falls
        // back to the column default just like a blank does.
        value = toYesNo(value);
      }
      const fallback = applyDefaults ? (defaultFor(key) ?? '') : '';
      const fixed = applyDefaults ? getOwn(REWAA_FIXED_VALUES, normalizeHeader(key)) : undefined;
      setOwn(out, key, fixed !== undefined ? fixed : isBlank(value) ? fallback : value);
    }
    if (variantNameKey && isBlank(getOwn(out, variantNameKey))) {
      setOwn(out, variantNameKey, buildVariantName(out, templateHeaders));
    }
    return out;
  });
}

/**
 * Columns a Rewaa export ALWAYS gets, whatever the extraction said — unlike
 * TEMPLATE_DEFAULTS, which only fill a blank.
 *
 * `Enable stock management` is `no` on every Rewaa template: the approved
 * Rewaa-template behaviour (product owner, reaffirmed 2026-09-29). The OCR
 * prompt asks the model for this column, so a `yes` could arrive and, as a
 * mere default, used to pass straight through into the export. Rewaa
 * templates only: a non-Rewaa template keeps the extracted value.
 */
const REWAA_FIXED_VALUES: Readonly<Record<string, string>> = {
  'enable stock management': 'no',
};

/**
 * Rewaa columns whose spec row says `list yes no` — the importer accepts only
 * those two words. Normalised so an extracted `Yes`, `TRUE`, `1` or `نعم`
 * arrives as `yes` rather than failing the import.
 */
const YES_NO_COLUMNS: ReadonlySet<string> = new Set([
  'sellable', 'purchasable', 'enable stock management',
  'weighted', 'tracked by batch', 'tracked by serial',
  ...[1, 2, 3].flatMap((n) => [`pack${n} sellable`, `pack${n} purchasable`]),
]);
const YES_WORDS: ReadonlySet<string> = new Set(['yes', 'y', 'true', '1', 'نعم']);
const NO_WORDS: ReadonlySet<string> = new Set(['no', 'n', 'false', '0', 'لا']);

/** `yes` / `no`, or undefined for anything that is neither — which then takes the default. */
export function toYesNo(value: unknown): 'yes' | 'no' | undefined {
  if (value === true) return 'yes';
  if (value === false) return 'no';
  const s = String(value ?? '').trim().toLowerCase();
  if (YES_WORDS.has(s)) return 'yes';
  if (NO_WORDS.has(s)) return 'no';
  return undefined;
}

/** The template's own spelling of a column, found by meaning. */
function headerFor(templateHeaders: readonly unknown[], normalized: string): string | undefined {
  const hit = templateHeaders.find((h) => normalizeHeader(h) === normalized);
  return hit === undefined ? undefined : String(hit);
}

/**
 * `Product Name | Option 1 Value | Option 2 Value | Option 3 Value`, skipping
 * blanks — the convention in the supplied template (`حري | Hari | نص | Half`).
 *
 * Built from the MAPPED row, so it uses exactly what the file will contain.
 * Blank when there is no product name or no option value at all: a variant row
 * with no option is not a variant, and a guessed name would hide that.
 * Build only — the halves themselves contain ` | `, so it cannot be split back.
 */
export function buildVariantName(out: TemplateRow, templateHeaders: readonly unknown[]): string {
  const valueOf = (norm: string) => {
    const k = headerFor(templateHeaders, norm);
    const v = k === undefined ? undefined : getOwn(out, k);
    return isBlank(v) ? '' : String(v).trim();
  };
  const name = valueOf('product name');
  const options = ['option 1 value', 'option 2 value', 'option 3 value'].map(valueOf).filter(Boolean);
  return name && options.length > 0 ? [name, ...options].join(' | ') : '';
}

/**
 * Which sheet a generic row belongs to. Moved here unchanged from OcrTab so the
 * export and the comparison columns route rows identically.
 */
export function isVariableRow(row: TemplateRow): boolean {
  // `||`, not `??`, exactly as the original: an empty `Type` falls through to `type`.
  const type = String(getOwn(row, 'Type') || getOwn(row, 'type') || '').toLowerCase();
  return type.includes('variable') || type.includes('var');
}

/** A simple product carries no option or variant columns. Unchanged from OcrTab. */
export function stripForSimple(row: TemplateRow): TemplateRow {
  const out: TemplateRow = {};
  for (const k of Object.keys(row)) {
    const lower = k.toLowerCase();
    if (!lower.includes('option') && !lower.includes('variant')) setOwn(out, k, row[k]);
  }
  return out;
}

/** A variable product carries no product-level SKU. Unchanged from OcrTab. */
export function stripForVariable(row: TemplateRow): TemplateRow {
  const out: TemplateRow = {};
  for (const k of Object.keys(row)) {
    const lower = k.toLowerCase();
    if (lower !== 'product sku' && lower !== 'product_sku') setOwn(out, k, row[k]);
  }
  return out;
}

/** The fields a mismatch would actually hurt. Variant Name is excluded — it may be constructed. */
const COMPARED_COLUMNS: ReadonlySet<string> = new Set([
  'product name', 'product sku', 'variant sku', 'retail price', 'category',
  'option 1 value', 'option 2 value', 'option 3 value',
]);

/**
 * Does the mapped template row carry the generic row's data faithfully?
 *
 * The expected value is found in the GENERIC row independently of the mapping —
 * by the same resolver, not by trusting the mapping — so a price the mapping
 * missed, or pointed at the wrong column, shows up as FALSE. That is the point
 * of the check: it audits the mapping, it does not restate it.
 *
 * A field the extraction left blank is not compared.
 */
export function matchesTemplate(
  generic: TemplateRow,
  mapped: TemplateRow,
  templateHeaders: readonly unknown[],
): boolean {
  const keys = Object.keys(generic);
  for (const h of templateHeaders) {
    if (!COMPARED_COLUMNS.has(normalizeHeader(h))) continue;
    const src = resolveSourceKey(h, keys);
    if (src === undefined) continue;
    const expected = getOwn(generic, src);
    if (isBlank(expected)) continue;
    if (String(getOwn(mapped, String(h)) ?? '').trim() !== String(expected).trim()) return false;
  }
  return true;
}

/**
 * Columns only a Rewaa import template has together. Both templates — Simple
 * and Variable — carry all three; generic product sheets rarely carry any.
 */
const REWAA_SIGNATURE = ['enable stock management', 'tracked by batch', 'tracked by serial'] as const;

/**
 * Is this a Rewaa import template? True when every signature column is present
 * AND there is a Rewaa SKU column (`Product SKU` for Simple, `Variant SKU` for
 * Variable). Deliberately strict: a false negative costs blanks the user can
 * see; a false positive silently fills another platform's columns.
 */
export function isRewaaTemplate(templateHeaders: readonly unknown[]): boolean {
  const have = new Set(templateHeaders.map(normalizeHeader));
  return REWAA_SIGNATURE.every((c) => have.has(c)) && (have.has('product sku') || have.has('variant sku'));
}

/** Is this upload a CSV? By extension first, MIME type as a fallback. */
export const isCsvFile = (name: string, mimeType = ''): boolean =>
  /\.csv$/i.test(name) || mimeType === 'text/csv';

/**
 * Rows of a CSV template from its DECODED TEXT — pass `await file.text()`.
 *
 * Why not `readExcelFile`: it hands SheetJS the raw bytes, and a UTF-8 CSV
 * without a BOM (every Google Sheets export) is then decoded as Latin-1, so an
 * Arabic header comes out as mojibake, matches nothing, and is written back to
 * the export as garbage. That is TD-050. `File.text()` decodes as UTF-8 and
 * drops a BOM, so parsing the text sidesteps it. Scoped to template upload on
 * purpose — the app-wide fix belongs to TD-050 and touches `.xls` too.
 *
 * The SheetJS instance is passed in, as `lookupEngine` does, so this module
 * carries no runtime dependency on the library.
 */
export function parseCsvTemplate(lib: typeof XLSXNS, text: string): unknown[][] {
  const wb = lib.read(text, { type: 'string' });
  return lib.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {
    header: 1, defval: '', raw: false,
  }) as unknown[][];
}

/** Template headers as loaded, with a CSV's leading BOM removed from the first. */
export const cleanTemplateHeaders = (headers: readonly unknown[]): string[] =>
  headers.map((h, i) => (i === 0 ? String(h ?? '').replace(/^\uFEFF/, '') : String(h ?? '')));
