/**
 * "Ready to upload" for Composite Check: the Raw sheet mapped into Rewaa's
 * Simple Products import template, and the VALID composite rows into Rewaa's
 * Composite Products import template — the product owner's own templates,
 * header for header (`utils/rewaaUploadTemplates.ts`) — plus an Identical check
 * that re-reads the built files and compares them with the source, the way
 * OCR → Rewaa does (`sameValue`).
 *
 * Pure: no React, no workbook library. Decisions it encodes (2026-10-06):
 *   - columns are found by HEADER, never by position: the automatic-mapping
 *     rule (exact name, then ordered aliases, else nothing; two equal matches
 *     = ambiguous). Anything missing that is required, or ambiguous, STOPS the
 *     build and is reported — no silent choice;
 *   - the raw quantity goes to the template's `DEF Quantity` (it has no
 *     `Quantity` column);
 *   - the template's spec row (row 2) IS written under the headers — an
 *     approved exception to D7 rule 1 for these upload files;
 *   - nothing is invented: a blank stays blank, never 0; an unreadable number
 *     is written as its text and fails the Identical check;
 *   - ingredient N always goes to `ProductN SKU` / `ProductN Rate`: an empty
 *     slot stays empty, nothing moves up;
 *   - an ingredient SKU is written as the Raw sheet spells it (matched with
 *     `identifierKey`, D7), so the composite points at the uploaded material.
 */
import { SIMPLE_UPLOAD_HEADERS, SIMPLE_UPLOAD_SPEC_ROW, COMPOSITE_UPLOAD_HEADERS, COMPOSITE_UPLOAD_SPEC_ROW } from './rewaaUploadTemplates';
import { MAPPING_ALIASES, matchColumn, NO_COLUMN } from './compositeMapping';
import { normalizeHeader } from './templateMapping';
import { identifierKey } from './identifiers';
import { parseAmount } from './compositeFinancials';
import { sameValue } from './ocrRewaaExport';
import { plainNumberString } from './cellText';

export const MAX_INGREDIENTS = 30;

/** One source row: its display text (for names and SKUs), its raw values (for numbers), its sheet row number. */
export interface SourceRow {
  text: readonly unknown[];
  value: readonly unknown[];
  sourceRow: number;
}

export type MappingType = 'automatic' | 'manual';

interface FieldDef {
  key: string;
  output: string;
  aliases: readonly string[];
  numeric: boolean;
  required: boolean;
  /** An identifier (a SKU): read from the cell's value, not its number format. */
  id?: boolean;
}

/** Raw sheet → Simple template. Aliases as the automatic mapping, plus quantity and category. */
export const RAW_FIELDS: readonly FieldDef[] = [
  { key: 'name', output: 'Product Name', aliases: MAPPING_ALIASES.name, numeric: false, required: true },
  { key: 'sku', output: 'Product SKU', aliases: MAPPING_ALIASES.sku, numeric: false, required: true, id: true },
  { key: 'cost', output: 'Cost', aliases: MAPPING_ALIASES.cost, numeric: true, required: false },
  // The template has no `Quantity` column: `DEF Quantity` (product owner, 2026-10-06).
  { key: 'quantity', output: 'DEF Quantity', aliases: ['quantity', 'الكمية حسب الوحدة المستخدمة', 'def quantity'], numeric: true, required: false },
  { key: 'category', output: 'Category', aliases: ['category', 'الفئة'], numeric: false, required: false },
];

/** Composite sheet → Composite template (the ingredient pairs are separate). */
export const COMPOSITE_FIELDS: readonly FieldDef[] = [
  { key: 'name', output: 'Product Name', aliases: ['product name', 'اسم المنتج المجمع', 'name'], numeric: false, required: true },
  { key: 'sku', output: 'Product SKU', aliases: ['product sku', 'رمز المنتج المجمع', 'sku'], numeric: false, required: true, id: true },
  { key: 'category', output: 'Category', aliases: ['category', 'فئة المنتج'], numeric: false, required: false },
  { key: 'retail', output: 'Retail Price', aliases: MAPPING_ALIASES.retail, numeric: true, required: false },
];

/**
 * Numbered ingredient headers (normalised form). The Arabic template's own
 * (`الرمز التعريفي للمادة الخام رقم 3مطابق…`, `مقدار الاستخدام من المادة4` — its
 * spacing varies), Rewaa's (`Product3 SKU`, `Product3 Rate`), and plain
 * `Ingredient 3 SKU` / `Ingredient 3 Rate|Qty|Quantity`.
 */
const INGREDIENT_SKU = [/^الرمز التعريفي للمادة الخام رقم\s*(\d+)/, /^product\s*(\d+)\s*sku$/, /^ingredient\s*(\d+)\s*sku$/];
const INGREDIENT_RATE = [/^مقدار الاستخدام من المادة\s*(\d+)$/, /^product\s*(\d+)\s*rate$/, /^ingredient\s*(\d+)\s*(?:rate|qty|quantity)$/];

export interface ColumnPlan {
  key: string;
  output: string;
  col: number;
  /** The source header as written, '' when none. */
  header: string;
  type: MappingType;
  status: 'found' | 'missing' | 'ambiguous';
  required: boolean;
}

export interface IngredientPlan {
  n: number;
  skuCol: number;
  rateCol: number;
  skuHeader: string;
  rateHeader: string;
}

export interface UploadPlan {
  raw: ColumnPlan[];
  composite: ColumnPlan[];
  /** Always 30 entries, 1..30; a slot with no source column has col -1. */
  ingredients: IngredientPlan[];
  /** Why nothing can be built: a required column missing, anything ambiguous, unrecognised ingredients. Empty = buildable. */
  problems: string[];
}

const headerText = (h: unknown) => String(h ?? '').trim();

function planFields(headers: readonly unknown[], fields: readonly FieldDef[], overrides: Readonly<Record<string, { col: number; type: MappingType }>>, sheet: string, problems: string[]): ColumnPlan[] {
  const taken = new Set<number>();
  // Columns the user picked are taken first, so the automatic ones cannot reuse them.
  for (const f of fields) {
    const o = overrides[f.key];
    if (o && o.col !== NO_COLUMN && o.col < headers.length) taken.add(o.col);
  }
  return fields.map((f) => {
    const o = overrides[f.key];
    if (o && o.col !== NO_COLUMN && o.col < headers.length) {
      return { key: f.key, output: f.output, col: o.col, header: headerText(headers[o.col]), type: o.type, status: 'found', required: f.required };
    }
    const m = matchColumn(headers, f.aliases, { taken });
    if (m.outcome === 'found') taken.add(m.col);
    if (m.outcome === 'ambiguous') problems.push(`${sheet}: more than one column could be "${f.output}"; choose it in the mapping.`);
    else if (m.outcome === 'missing' && f.required) problems.push(`${sheet}: no column for "${f.output}" (looked for: ${f.aliases.join(', ')}).`);
    return { key: f.key, output: f.output, col: m.col, header: m.col === NO_COLUMN ? '' : headerText(headers[m.col]), type: 'automatic', status: m.outcome, required: f.required };
  });
}

function planIngredients(headers: readonly unknown[], used: ReadonlySet<number>, problems: string[]): IngredientPlan[] {
  const sku = new Map<number, number[]>();
  const rate = new Map<number, number[]>();
  headers.forEach((h, i) => {
    if (used.has(i)) return;
    const n = normalizeHeader(h);
    for (const [patterns, into] of [[INGREDIENT_SKU, sku], [INGREDIENT_RATE, rate]] as const) {
      for (const p of patterns) {
        const m = p.exec(n);
        if (m) {
          const k = Number(m[1]);
          into.set(k, [...(into.get(k) ?? []), i]);
          break;
        }
      }
    }
  });
  if (sku.size === 0 && rate.size === 0) problems.push('Composite sheet: no numbered ingredient columns were recognised (expected headers like "الرمز التعريفي للمادة الخام رقم 1" / "مقدار الاستخدام من المادة 1", or "Product1 SKU" / "Product1 Rate").');
  for (const k of new Set([...sku.keys(), ...rate.keys()])) {
    if (k < 1 || k > MAX_INGREDIENTS) problems.push(`Composite sheet: ingredient ${k} has no place in the template (Product1..Product${MAX_INGREDIENTS}).`);
    if ((sku.get(k)?.length ?? 0) > 1) problems.push(`Composite sheet: more than one column for ingredient ${k} SKU.`);
    if ((rate.get(k)?.length ?? 0) > 1) problems.push(`Composite sheet: more than one column for ingredient ${k} usage.`);
    if (!sku.has(k)) problems.push(`Composite sheet: ingredient ${k} has a usage column but no SKU column.`);
    if (!rate.has(k)) problems.push(`Composite sheet: ingredient ${k} has a SKU column but no usage column.`);
  }
  return Array.from({ length: MAX_INGREDIENTS }, (_, i) => {
    const n = i + 1;
    const s = sku.get(n)?.[0] ?? NO_COLUMN;
    const r = rate.get(n)?.[0] ?? NO_COLUMN;
    return { n, skuCol: s, rateCol: r, skuHeader: s === NO_COLUMN ? '' : headerText(headers[s]), rateHeader: r === NO_COLUMN ? '' : headerText(headers[r]) };
  });
}

/**
 * Which source column feeds which template column. `overrides` are the
 * dropdowns the user (or the automatic mapping) set in Composite Check —
 * `rawSkuCol`, `costCol`, `rawNameCol`, `retailPriceCol`; a field left at -1 is
 * found by its header here.
 */
export function planReadyToUpload(
  rawHeaders: readonly unknown[],
  compositeHeaders: readonly unknown[],
  overrides: { raw?: Record<string, { col: number; type: MappingType }>; composite?: Record<string, { col: number; type: MappingType }> } = {},
): UploadPlan {
  const problems: string[] = [];
  const raw = planFields(rawHeaders, RAW_FIELDS, overrides.raw ?? {}, 'Raw sheet', problems);
  const composite = planFields(compositeHeaders, COMPOSITE_FIELDS, overrides.composite ?? {}, 'Composite sheet', problems);
  const used = new Set(composite.filter((c) => c.col !== NO_COLUMN).map((c) => c.col));
  const ingredients = planIngredients(compositeHeaders, used, problems);
  return { raw, composite, ingredients, problems: [...new Set(problems)] };
}

// ─── Values ─────────────────────────────────────────────────────────────────

const isBlank = (v: unknown) => v === null || v === undefined || String(v).trim() === '';

/** A text cell as written (trimmed), or null for blank. */
const textCell = (v: unknown): string | null => (isBlank(v) ? null : String(v).trim());

/**
 * An identifier cell. A SKU stored as a NUMBER is shown through its number
 * format, and that format is not part of the code: the real Raw sheet has
 * `846550779892` formatted `0.00`, displayed `846550779892.00`. So a whole
 * number is written as its digits — unless the display is itself all digits
 * (a zero-padded `00123` format), which is then the code as the user sees it.
 * Anything else: the trimmed display text, as written.
 */
function identifierCell(raw: unknown, shown: unknown): string | null {
  if (typeof raw === 'number' && Number.isInteger(raw)) {
    const display = textCell(shown);
    return display !== null && /^\d+$/.test(display) ? display : plainNumberString(raw);
  }
  return textCell(shown) ?? textCell(raw);
}

/** A number cell: the number; null for blank; the trimmed text when it is not a number (never 0). */
function numberCell(raw: unknown, shown: unknown): number | string | null {
  const a = parseAmount(raw);
  if (a.kind === 'ok') return a.value;
  if (a.kind === 'empty') return null;
  const t = textCell(shown) ?? textCell(raw);
  return t;
}

const fieldValue = (row: SourceRow, p: ColumnPlan, numeric: boolean, id = false): string | number | null =>
  p.col === NO_COLUMN ? null
    : numeric ? numberCell(row.value[p.col], row.text[p.col])
    : id ? identifierCell(row.value[p.col], row.text[p.col])
    : textCell(row.text[p.col]);

const fieldOf = (plans: readonly ColumnPlan[], key: string) => plans.find((p) => p.key === key)!;

export type UploadCell = string | number | null;

/** The upload file's sheet: headers, the spec row, then one row per product. */
export interface UploadSheet {
  rows: UploadCell[][];
  /** The source rows behind each data row, in order. */
  sources: SourceRow[];
}

/**
 * The Raw sheet as Rewaa Simple products. A row with nothing in name, SKU,
 * cost or quantity is a pre-filled template line (the real file has 915 rows
 * holding only the category `خام`) and is skipped.
 */
export function buildSimpleUpload(rawRows: readonly SourceRow[], plan: UploadPlan): UploadSheet & { skipped: number } {
  const p = (k: string) => fieldOf(plan.raw, k);
  const included = rawRows.filter((r) => ['name', 'sku', 'cost', 'quantity'].some((k) => fieldValue(r, p(k), k === 'cost' || k === 'quantity', k === 'sku') !== null));
  const rows: UploadCell[][] = [[...SIMPLE_UPLOAD_HEADERS], [...SIMPLE_UPLOAD_SPEC_ROW]];
  for (const r of included) {
    const byHeader = new Map<string, UploadCell>();
    for (const f of RAW_FIELDS) byHeader.set(f.output, fieldValue(r, p(f.key), f.numeric, f.id));
    rows.push(SIMPLE_UPLOAD_HEADERS.map((h) => byHeader.get(h) ?? null));
  }
  return { rows, sources: included, skipped: rawRows.length - included.length };
}

/** identifierKey → the SKU as the Simple upload writes it (first row wins). */
export function rawSkuIndex(simple: UploadSheet): Map<string, string> {
  const col = SIMPLE_UPLOAD_HEADERS.indexOf('Product SKU');
  const index = new Map<string, string>();
  for (const row of simple.rows.slice(2)) {
    const sku = row[col];
    const key = identifierKey(sku);
    if (key && !index.has(key)) index.set(key, String(sku));
  }
  return index;
}

/** The VALID composite rows as Rewaa Composite products; ingredient N → ProductN. */
export function buildCompositeUpload(validRows: readonly SourceRow[], plan: UploadPlan, rawIndex: ReadonlyMap<string, string>): UploadSheet {
  const rows: UploadCell[][] = [[...COMPOSITE_UPLOAD_HEADERS], [...COMPOSITE_UPLOAD_SPEC_ROW]];
  for (const r of validRows) {
    const byHeader = new Map<string, UploadCell>();
    for (const f of COMPOSITE_FIELDS) byHeader.set(f.output, fieldValue(r, fieldOf(plan.composite, f.key), f.numeric, f.id));
    for (const ing of plan.ingredients) {
      const sku = ing.skuCol === NO_COLUMN ? null : identifierCell(r.value[ing.skuCol], r.text[ing.skuCol]);
      // The Raw sheet's spelling when it is there; otherwise as written (flagged by the check).
      byHeader.set(`Product${ing.n} SKU`, sku === null ? null : rawIndex.get(identifierKey(sku)) ?? sku);
      byHeader.set(`Product${ing.n} Rate`, ing.rateCol === NO_COLUMN ? null : numberCell(r.value[ing.rateCol], r.text[ing.rateCol]));
    }
    rows.push(COMPOSITE_UPLOAD_HEADERS.map((h) => byHeader.get(h) ?? null));
  }
  return { rows, sources: [...validRows] };
}

// ─── Identical ──────────────────────────────────────────────────────────────

export interface RowCheck {
  sourceRow: number;
  sku: string;
  name: string;
  identical: 'yes' | 'no';
  differences: string[];
}

export interface UploadCheck {
  /** Header or spec row not exactly the template's, or a row count that does not match the source. */
  structure: string[];
  rows: RowCheck[];
}

const shown = (v: unknown) => (isBlank(v) ? '(blank)' : `'${String(v).trim()}'`);

function compareStructure(rows: readonly (readonly unknown[])[], headers: readonly string[], spec: readonly string[], expectedRows: number): string[] {
  const out: string[] = [];
  const head = rows[0] ?? [];
  if (head.length !== headers.length || headers.some((h, i) => head[i] !== h)) {
    const i = headers.findIndex((h, j) => head[j] !== h);
    out.push(`Header row differs from the template${i >= 0 ? ` at column ${i + 1}: expected '${headers[i]}', found ${shown(head[i])}` : ` (${head.length} columns, expected ${headers.length})`}.`);
  }
  const specRow = rows[1] ?? [];
  if (spec.some((s, i) => (specRow[i] ?? '') !== s)) out.push('Row 2 differs from the template\'s specification row.');
  if (rows.length - 2 !== expectedRows) out.push(`${rows.length - 2} data rows, expected ${expectedRows}.`);
  return out;
}

/** One expected value vs the cell, with the OCR comparison; a reason when they differ. */
function diff(header: string, expected: UploadCell, found: unknown, numeric: boolean): string | null {
  if (isBlank(expected) && isBlank(found)) return null;
  if (!isBlank(expected) && !isBlank(found) && sameValue(expected, found, numeric)) return null;
  return `${header} mismatch: expected ${shown(expected)}, found ${shown(found)}`;
}

const notANumber = (header: string, v: UploadCell) =>
  typeof v === 'string' ? `${header} ${shown(v)} is not a number` : null;

/**
 * Re-reads a built Simple upload (as cells, possibly edited) against the Raw
 * sheet: every template column, mapped or not, and the rules an import needs —
 * a name and a SKU, numbers that are numbers, no SKU twice.
 */
export function checkSimpleUpload(rows: readonly (readonly unknown[])[], sources: readonly SourceRow[], plan: UploadPlan): UploadCheck {
  const structure = compareStructure(rows, SIMPLE_UPLOAD_HEADERS, SIMPLE_UPLOAD_SPEC_ROW, sources.length);
  const p = (k: string) => fieldOf(plan.raw, k);
  const seen = new Map<string, number>();
  const checks = sources.map((src, i) => {
    const out = rows[i + 2] ?? [];
    const expected = new Map<string, { v: UploadCell; numeric: boolean }>();
    for (const f of RAW_FIELDS) expected.set(f.output, { v: fieldValue(src, p(f.key), f.numeric, f.id), numeric: f.numeric });
    const differences: string[] = [];
    SIMPLE_UPLOAD_HEADERS.forEach((h, c) => {
      const e = expected.get(h) ?? { v: null, numeric: false };
      const d = diff(h, e.v, out[c], e.numeric);
      if (d) differences.push(d);
      const nan = e.numeric ? notANumber(h, e.v) : null;
      if (nan) differences.push(nan);
    });
    const sku = expected.get('Product SKU')!.v;
    const name = expected.get('Product Name')!.v;
    if (isBlank(sku)) differences.push('Product SKU is blank in the source');
    if (isBlank(name)) differences.push('Product Name is blank in the source');
    const key = identifierKey(sku);
    if (key && seen.has(key)) differences.push(`Product SKU ${shown(sku)} is also on source row ${seen.get(key)}`);
    else if (key) seen.set(key, src.sourceRow);
    return { sourceRow: src.sourceRow, sku: String(sku ?? ''), name: String(name ?? ''), identical: differences.length ? 'no' : 'yes', differences } as RowCheck;
  });
  return { structure, rows: checks };
}

/**
 * Re-reads a built Composite upload against the valid composite rows: name,
 * SKU, category, retail price and all 30 ProductN pairs — the SKU must be the
 * source's ingredient N (by identifierKey) AND a material in the Simple upload,
 * the rate must be ingredient N's usage, and a slot with nothing in the source
 * must be empty (so a shifted ingredient is caught).
 */
export function checkCompositeUpload(rows: readonly (readonly unknown[])[], sources: readonly SourceRow[], plan: UploadPlan, rawKeys: ReadonlySet<string>): UploadCheck {
  const structure = compareStructure(rows, COMPOSITE_UPLOAD_HEADERS, COMPOSITE_UPLOAD_SPEC_ROW, sources.length);
  const col = (h: string) => COMPOSITE_UPLOAD_HEADERS.indexOf(h as (typeof COMPOSITE_UPLOAD_HEADERS)[number]);
  const checks = sources.map((src, i) => {
    const out = rows[i + 2] ?? [];
    const differences: string[] = [];
    const mapped = new Set<string>();
    for (const f of COMPOSITE_FIELDS) {
      const e = fieldValue(src, fieldOf(plan.composite, f.key), f.numeric, f.id);
      mapped.add(f.output);
      const d = diff(f.output, e, out[col(f.output)], f.numeric);
      if (d) differences.push(d);
      const nan = f.numeric ? notANumber(f.output, e) : null;
      if (nan) differences.push(nan);
    }
    for (const ing of plan.ingredients) {
      const skuH = `Product${ing.n} SKU`;
      const rateH = `Product${ing.n} Rate`;
      mapped.add(skuH).add(rateH);
      const eSku = ing.skuCol === NO_COLUMN ? null : identifierCell(src.value[ing.skuCol], src.text[ing.skuCol]);
      const oSku = out[col(skuH)];
      if (isBlank(eSku) !== isBlank(oSku) || (!isBlank(eSku) && identifierKey(eSku) !== identifierKey(oSku))) {
        differences.push(`${skuH} mismatch: expected ${shown(eSku)}, found ${shown(oSku)}`);
      } else if (!isBlank(oSku) && !rawKeys.has(identifierKey(oSku))) {
        differences.push(`${skuH} ${shown(oSku)} is not a raw material in the Simple upload`);
      }
      const eRate = ing.rateCol === NO_COLUMN ? null : numberCell(src.value[ing.rateCol], src.text[ing.rateCol]);
      const d = diff(rateH, eRate, out[col(rateH)], true);
      if (d) differences.push(d);
      const nan = notANumber(rateH, eRate);
      if (nan) differences.push(nan);
    }
    COMPOSITE_UPLOAD_HEADERS.forEach((h, c) => {
      if (!mapped.has(h) && !isBlank(out[c])) differences.push(`${h} mismatch: expected (blank), found ${shown(out[c])}`);
    });
    const sku = fieldValue(src, fieldOf(plan.composite, 'sku'), false, true);
    const name = fieldValue(src, fieldOf(plan.composite, 'name'), false);
    if (isBlank(sku)) differences.push('Product SKU is blank in the source');
    if (isBlank(name)) differences.push('Product Name is blank in the source');
    return { sourceRow: src.sourceRow, sku: String(sku ?? ''), name: String(name ?? ''), identical: differences.length ? 'no' : 'yes', differences } as RowCheck;
  });
  return { structure, rows: checks };
}

// ─── Report sheets (for the validated workbook) ─────────────────────────────

export const CHECK_HEADER = ['Source Row', 'Product SKU', 'Product Name', 'Rewaa Data Identical', 'Differences'];

export function checkSheetRows(check: UploadCheck): (string | number)[][] {
  return [
    CHECK_HEADER,
    ...check.structure.map((s) => ['', '', '', 'no', `File structure: ${s}`]),
    ...check.rows.map((r) => [r.sourceRow, r.sku, r.name, r.identical, r.differences.join('; ')]),
  ];
}

export const AUDIT_HEADER = ['Source Sheet', 'Source Header', 'Output File', 'Output Header', 'Mapping Type', 'Status'];

const auditStatus = (p: { status: string; required: boolean }) =>
  p.status === 'found' ? 'PASS' : p.status === 'ambiguous' ? 'AMBIGUOUS' : p.required ? 'MISSING' : 'NOT IN SOURCE (left blank)';

/** Every template column that receives data, and where it comes from. */
export function mappingAuditRows(plan: UploadPlan, rawSheet: string, compositeSheet: string): string[][] {
  const rows: string[][] = [AUDIT_HEADER];
  for (const p of plan.raw) rows.push([rawSheet, p.header || '(none)', 'Simple', p.output, p.type, auditStatus(p)]);
  for (const p of plan.composite) rows.push([compositeSheet, p.header || '(none)', 'Composite', p.output, p.type, auditStatus(p)]);
  for (const ing of plan.ingredients) {
    for (const [h, c, out] of [[ing.skuHeader, ing.skuCol, `Product${ing.n} SKU`], [ing.rateHeader, ing.rateCol, `Product${ing.n} Rate`]] as const) {
      rows.push([compositeSheet, h || '(none)', 'Composite', out, 'automatic', c === NO_COLUMN ? 'NOT IN SOURCE (left blank)' : 'PASS']);
    }
  }
  return rows;
}

export interface ReadySummary {
  simpleRows: number;
  compositeRows: number;
  simpleIdentical: number;
  compositeIdentical: number;
  materialsUsed: number;
  ingredientLinks: number;
  missingIngredients: number;
}

export function readySummary(simple: UploadCheck, composite: UploadCheck, compositeUpload: UploadSheet, rawKeys: ReadonlySet<string>): ReadySummary {
  const firstSku = COMPOSITE_UPLOAD_HEADERS.indexOf('Product1 SKU');
  const used = new Set<string>();
  let links = 0;
  let missing = 0;
  for (const row of compositeUpload.rows.slice(2)) {
    for (let n = 0; n < MAX_INGREDIENTS; n++) {
      const v = row[firstSku + n * 2];
      if (isBlank(v)) continue;
      const key = identifierKey(v);
      if (rawKeys.has(key)) { links++; used.add(key); } else missing++;
    }
  }
  return {
    simpleRows: simple.rows.length,
    compositeRows: composite.rows.length,
    simpleIdentical: simple.rows.filter((r) => r.identical === 'yes').length,
    compositeIdentical: composite.rows.filter((r) => r.identical === 'yes').length,
    materialsUsed: used.size,
    ingredientLinks: links,
    missingIngredients: missing,
  };
}
