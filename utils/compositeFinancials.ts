/**
 * Cost and profit for Composite Check — the ONE place the formula lives.
 *
 * The Cost & Profit Analyzer tab (`components/CompositeTab.tsx`) defined the
 * model, and this module keeps it exactly:
 *
 *   - the Financial Mapping is four column indexes, `-1` meaning "not mapped":
 *     Raw sheet SKU, Raw sheet Cost, Raw sheet Name (optional), and the
 *     Composite sheet's Retail Price (optional);
 *   - a composite's cost is the sum of `unit cost × quantity` over its
 *     ingredient (SKU, Qty) pairs, where the unit cost is the Raw sheet's Cost
 *     for that ingredient SKU;
 *   - `Profit = Retail Price − Cost`, `Margin % = Profit ÷ Retail Price`.
 *
 * Two readings of the same data use it:
 *
 *   - the ANALYZER keeps its original, lenient reading — a missing or
 *     unreadable cost or price counts as 0 (`legacyAmount`) — so its dashboard
 *     and its export behave exactly as before;
 *   - the VALIDATED EXPORT reads strictly (`parseAmount`): a missing or
 *     unreadable number is reported, never turned into 0, and a product whose
 *     cost cannot be known gets no cost and no profit rather than a wrong one.
 *
 * SKUs are matched with `identifierKey` (decision D7): invisible characters are
 * ignored, and leading zeros and letter case are kept.
 */
import { identifierKey } from './identifiers';
import { classifyQuantity } from './quantityRule';

/** The Financial Mapping, as the Cost & Profit Analyzer stores it. `-1` = not mapped. */
export interface FinancialMapping {
  rawSkuCol: number;
  costCol: number;
  rawNameCol: number;
  retailPriceCol: number;
}

export const NOT_MAPPED = -1;

/** Financials are produced only when the Raw SKU and Cost columns are both mapped. */
export const financialsEnabled = (m: FinancialMapping): boolean =>
  m.rawSkuCol !== NOT_MAPPED && m.costCol !== NOT_MAPPED;

// ─── Numbers ─────────────────────────────────────────────────────────────────

export type Amount =
  | { kind: 'empty' }
  | { kind: 'ok'; value: number }
  | { kind: 'invalid'; text: string };

const PLAIN_DECIMAL = /^[+-]?(\d+(\.\d*)?|\.\d+)$/;
const GROUPED = /^[+-]?\d{1,3}(,\d{3})+(\.\d+)?$/;

/**
 * A money cell, read strictly. A number cell is its number; a text cell must be
 * a plain decimal (`12`, `12.50`, `-3`) or one with thousands separators
 * (`1,250.00`). Anything else — `abc`, `12 SAR`, `1.2.3`, `Infinity` — is
 * `invalid` and keeps its text so the message can quote it. Blank is `empty`.
 */
export function parseAmount(raw: unknown): Amount {
  if (typeof raw === 'number') return Number.isFinite(raw) ? { kind: 'ok', value: raw } : { kind: 'invalid', text: String(raw) };
  if (raw === null || raw === undefined) return { kind: 'empty' };
  const text = String(raw).trim();
  if (text === '') return { kind: 'empty' };
  if (PLAIN_DECIMAL.test(text)) return { kind: 'ok', value: Number(text) };
  if (GROUPED.test(text)) return { kind: 'ok', value: Number(text.replace(/,/g, '')) };
  return { kind: 'invalid', text };
}

/**
 * The analyzer's original reading, unchanged: every character that is not a
 * digit or a dot is dropped, and whatever does not parse is 0.
 */
export const legacyAmount = (raw: unknown, fallback = '0'): number =>
  parseFloat(String(raw || fallback).replace(/[^0-9.]/g, '')) || 0;

// ─── The formula ─────────────────────────────────────────────────────────────

/** Below this, two money amounts are equal (floating-point noise, not money). */
const EPSILON = 1e-9;

export interface IngredientLine {
  qty: number;
  unitCost: number;
}

/** A composite's cost: the sum of `unit cost × quantity` over its ingredients. */
export const compositeCost = (lines: readonly IngredientLine[]): number =>
  lines.reduce((sum, l) => sum + l.unitCost * l.qty, 0);

export const profitOf = (retailPrice: number, cost: number): number => retailPrice - cost;

/** Margin as a FRACTION (0.25 for 25 %), 0 when there is no positive retail price. */
export const marginOf = (retailPrice: number, profit: number): number =>
  retailPrice > 0 ? profit / retailPrice : 0;

/** Margin in PERCENT (`25` for 25 %): the analyzer's `(profit / retail) * 100`, unchanged. */
export const marginPercentOf = (retailPrice: number, profit: number): number =>
  retailPrice > 0 ? marginOf(retailPrice, profit) * 100 : 0;

export type ProfitStatus = 'Profit' | 'Break-even' | 'Loss';

export const profitStatus = (profit: number): ProfitStatus =>
  profit > EPSILON ? 'Profit' : profit < -EPSILON ? 'Loss' : 'Break-even';

export const costExceedsRetail = (cost: number, retailPrice: number): boolean => cost - retailPrice > EPSILON;

// ─── The Raw sheet as a cost index ───────────────────────────────────────────

export interface RawEntry {
  sku: string;
  cost: Amount;
  name: string;
  /** 1-based row number in the Raw sheet (row 1 is the header). */
  row: number;
}

export interface CostIndex {
  /** First entry per SKU key. */
  entries: Map<string, RawEntry>;
  /** SKU keys listed more than once with DIFFERENT costs — their cost is unknown. */
  conflicts: Map<string, RawEntry[]>;
  /** SKU keys listed more than once with the same cost (harmless, reported). */
  repeats: Map<string, RawEntry[]>;
}

/**
 * Raw sheet rows (header excluded, in sheet order; `firstRow` is the 1-based
 * row number of the first one) → the cost of every raw SKU.
 */
export function buildCostIndex(rawRows: readonly unknown[][], m: FinancialMapping, firstRow = 2): CostIndex {
  const all = new Map<string, RawEntry[]>();
  rawRows.forEach((row, i) => {
    const sku = identifierKey(row[m.rawSkuCol]);
    if (!sku) return;
    const entry: RawEntry = {
      sku,
      cost: parseAmount(row[m.costCol]),
      name: m.rawNameCol === NOT_MAPPED ? '' : String(row[m.rawNameCol] ?? '').trim(),
      row: firstRow + i,
    };
    const list = all.get(sku);
    if (list) list.push(entry);
    else all.set(sku, [entry]);
  });
  const entries = new Map<string, RawEntry>();
  const conflicts = new Map<string, RawEntry[]>();
  const repeats = new Map<string, RawEntry[]>();
  const costKey = (a: Amount) => (a.kind === 'ok' ? `n:${a.value}` : a.kind === 'invalid' ? `t:${a.text}` : 'e');
  for (const [sku, list] of all) {
    entries.set(sku, list[0]);
    if (list.length > 1) {
      const distinct = new Set(list.map((e) => costKey(e.cost)));
      (distinct.size > 1 ? conflicts : repeats).set(sku, list);
    }
  }
  return { entries, conflicts, repeats };
}

// ─── One composite product ───────────────────────────────────────────────────

export interface FinancialIssue {
  /** English message, in the Validation Errors wording style. */
  message: string;
  /** The same message in Arabic, for the Arabic column. */
  arabic: string;
  /** 0-based column of the cell the issue points at. */
  col: number;
}

export interface BomLine {
  sku: string;
  name: string;
  qty: number | null;
  unitCost: number | null;
  lineCost: number | null;
}

export interface ProductFinancials {
  name: string;
  sku: string;
  /** null when the cost cannot be known (a missing, unreadable or conflicting cost, or no ingredients). */
  cost: number | null;
  /** null when Retail Price is not mapped, or the cell is missing or unreadable. */
  retailPrice: number | null;
  profit: number | null;
  /** Margin as a FRACTION (0.25 = 25 %) for a percent-formatted cell; null without a positive retail price. */
  margin: number | null;
  status: ProfitStatus | null;
  lines: BomLine[];
  issues: FinancialIssue[];
  /** Why cost or profit is blank, in plain words; '' when both are known. */
  note: string;
}

const money = (n: number): string => n.toFixed(2);

/**
 * The financials of one composite row (after Auto-Align): columns 0 and 1 are
 * the product's Name and SKU, the ingredient (SKU, Qty) pairs start at
 * `fixedColCount`. Never throws; never invents a number.
 */
export function productFinancials(
  row: readonly unknown[],
  fixedColCount: number,
  index: CostIndex,
  m: FinancialMapping,
): ProductFinancials {
  const issues: FinancialIssue[] = [];
  const notes: string[] = [];
  const lines: BomLine[] = [];
  let costKnown = true;

  for (let k = fixedColCount; k < row.length; k += 2) {
    const sku = identifierKey(row[k]);
    if (!sku) continue;
    const qtyRaw = row[k + 1];
    const qty = classifyQuantity(typeof qtyRaw === 'number' ? qtyRaw : String(qtyRaw ?? '').trim()) === 'ok' ? Number(qtyRaw) : null;
    const entry = index.entries.get(sku);
    let unitCost: number | null = null;
    if (!entry) {
      // Reported by the structure check as "SKU '…' missing"; here it only blanks the cost.
      notes.push(`ingredient '${sku}' is not in the Raw sheet`);
    } else if (index.conflicts.has(sku)) {
      const rows = index.conflicts.get(sku)!.map((e) => e.row).join(', ');
      issues.push({
        message: `Conflicting Cost for Ingredient '${sku}' (Raw rows ${rows})`,
        arabic: `تكلفة متعارضة للمكون '${sku}' (صفوف المواد الخام ${rows})`,
        col: k,
      });
    } else if (entry.cost.kind === 'empty') {
      issues.push({ message: `Missing Cost for Ingredient '${sku}'`, arabic: `التكلفة مفقودة للمكون '${sku}'`, col: k });
    } else if (entry.cost.kind === 'invalid') {
      issues.push({
        message: `Invalid Cost '${entry.cost.text}' for Ingredient '${sku}'`,
        arabic: `التكلفة غير صحيحة '${entry.cost.text}' للمكون '${sku}'`,
        col: k,
      });
    } else if (entry.cost.value < 0) {
      issues.push({
        message: `Negative Cost '${entry.cost.value}' for Ingredient '${sku}'`,
        arabic: `التكلفة بالسالب '${entry.cost.value}' للمكون '${sku}'`,
        col: k,
      });
    } else {
      unitCost = entry.cost.value;
    }
    // A bad quantity is reported by the structure check ("Non-numeric Qty" etc.).
    if (qty === null) notes.push(`ingredient '${sku}' has no usable quantity`);
    if (unitCost === null || qty === null) costKnown = false;
    lines.push({ sku, name: entry?.name ?? '', qty, unitCost, lineCost: unitCost !== null && qty !== null ? unitCost * qty : null });
  }

  if (lines.length === 0) {
    costKnown = false;
    notes.push('no ingredients');
  }
  if (!costKnown && issues.length) notes.unshift('a cost in the Raw sheet is missing or unusable');

  const cost = costKnown ? compositeCost(lines as IngredientLine[]) : null;

  let retailPrice: number | null = null;
  if (m.retailPriceCol !== NOT_MAPPED) {
    const amount = parseAmount(row[m.retailPriceCol]);
    if (amount.kind === 'ok' && amount.value >= 0) {
      retailPrice = amount.value;
    } else if (amount.kind === 'empty') {
      issues.push({ message: 'Missing Retail Price', arabic: 'سعر البيع مفقود', col: m.retailPriceCol });
    } else {
      const text = amount.kind === 'invalid' ? amount.text : String(amount.value);
      issues.push({ message: `Invalid Retail Price '${text}'`, arabic: `سعر البيع غير صحيح '${text}'`, col: m.retailPriceCol });
    }
  } else {
    notes.push('Retail Price is not mapped');
  }

  let profit: number | null = null;
  let margin: number | null = null;
  let status: ProfitStatus | null = null;
  if (cost !== null && retailPrice !== null) {
    profit = profitOf(retailPrice, cost);
    status = profitStatus(profit);
    margin = retailPrice > 0 ? marginOf(retailPrice, profit) : null;
    if (costExceedsRetail(cost, retailPrice)) {
      const loss = money(cost - retailPrice);
      issues.push({
        message: `Cost is higher than Retail Price (Cost ${money(cost)} > Retail Price ${money(retailPrice)}, loss ${loss})`,
        arabic: `التكلفة أعلى من سعر البيع (التكلفة ${money(cost)} > سعر البيع ${money(retailPrice)}، الخسارة ${loss})`,
        col: m.retailPriceCol,
      });
    }
  }

  return {
    name: String(row[0] ?? '').trim(),
    sku: String(row[1] ?? '').trim(),
    cost,
    retailPrice,
    profit,
    margin,
    status,
    lines,
    issues,
    note: cost === null || (retailPrice === null && m.retailPriceCol === NOT_MAPPED) ? capitalise(dedupe(notes).join('; ')) : '',
  };
}

const dedupe = (xs: string[]) => [...new Set(xs)];
const capitalise = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

// ─── The export sheets ───────────────────────────────────────────────────────

/** The Cost & Profit Analyzer's own sheet names, reused for the validated export. */
export const PROFIT_SHEET = 'Profit Analysis';
export const BOM_SHEET = 'Detailed BOM';

export const PROFIT_HEADER = ['Product Name', 'SKU', 'Retail Price', 'Cost', 'Profit', 'Margin %', 'Profit/Loss', 'Source Row', 'Note'] as const;
export const BOM_HEADER = ['Product Name', 'Product SKU', 'Ingredient SKU', 'Ingredient Name', 'Quantity', 'Unit Cost', 'Line Cost'] as const;

export type Cell = string | number;

/** `Profit Analysis` rows: numbers stay numbers, unknown values stay blank. */
export function profitSheetRows(products: readonly ProductFinancials[], sourceRows: readonly number[]): Cell[][] {
  return [
    [...PROFIT_HEADER],
    ...products.map((p, i) => [
      p.name, p.sku,
      p.retailPrice ?? '', p.cost ?? '', p.profit ?? '', p.margin ?? '',
      p.status ?? '', sourceRows[i] ?? '', p.note,
    ]),
  ];
}

/** `Detailed BOM` rows: one per ingredient line, as the analyzer's export lays them out. */
export function bomSheetRows(products: readonly ProductFinancials[]): Cell[][] {
  const rows: Cell[][] = [[...BOM_HEADER]];
  for (const p of products) {
    if (p.lines.length === 0) {
      rows.push([p.name, p.sku, '(No Ingredients)', '', '', '', '']);
      continue;
    }
    for (const l of p.lines) rows.push([p.name, p.sku, l.sku, l.name, l.qty ?? '', l.unitCost ?? '', l.lineCost ?? '']);
  }
  return rows;
}

export interface FinancialSummary {
  products: number;
  withProfit: number;
  breakEven: number;
  withLoss: number;
  costUnknown: number;
  costAboveRetail: number;
}

export function financialSummary(products: readonly ProductFinancials[]): FinancialSummary {
  return {
    products: products.length,
    withProfit: products.filter((p) => p.status === 'Profit').length,
    breakEven: products.filter((p) => p.status === 'Break-even').length,
    withLoss: products.filter((p) => p.status === 'Loss').length,
    costUnknown: products.filter((p) => p.cost === null).length,
    costAboveRetail: products.filter((p) => p.cost !== null && p.retailPrice !== null && costExceedsRetail(p.cost, p.retailPrice)).length,
  };
}
