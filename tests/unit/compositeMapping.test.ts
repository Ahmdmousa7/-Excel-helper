import { describe, it, expect } from 'vitest';
import {
  suggestColumn, suggestRawColumns, suggestRetailColumn, nextChoice, autoChoice, manualChoice, MAPPING_ALIASES, NO_COLUMN,
} from '../../utils/compositeMapping';
import { normalizeHeader } from '../../utils/templateMapping';

/**
 * Default columns for Composite Check's mapping: exact header, then known
 * aliases, otherwise nothing — never a position, never a guess.
 */

// The real Rewaa Composite template (نموذج منتج مجمع.xlsx), Raw sheet `الخامات`, in its own order.
const AR_RAW = [
  'اسم المادة الخام + اسم الوحدة المستخدمة',
  'الرقم التعريفي للمنتج (SKU)',
  'سعر التكلفة غير شامل الضريبة للوحدة الواحدة',
  'الكمية حسب الوحدة المستخدمة',
  'الفئة',
  'الضريبة',
];
// …and its Composite sheet `المنتج المجمع` (first columns).
const AR_COMP = ['اسم المنتج المجمع', 'رمز المنتج المجمع', 'فئة المنتج', 'سعر البيع', 'الرمز التعريفي للمادة الخام رقم 1 مطابق لرمز المرفوع علي النظام', 'مقدار الاستخدام من المادة 1'];

describe('the aliases', () => {
  it('are stored normalised, so they compare like the headers', () => {
    for (const list of Object.values(MAPPING_ALIASES)) for (const a of list) expect(normalizeHeader(a)).toBe(a);
  });
});

describe('suggestRawColumns', () => {
  it('exact standard headers', () => {
    expect(suggestRawColumns(['SKU', 'Name', 'Cost'])).toEqual({ sku: 0, cost: 2, name: 1 });
  });

  it('any column order', () => {
    expect(suggestRawColumns(['Cost', 'Category', 'Name', 'SKU'])).toEqual({ sku: 3, cost: 0, name: 2 });
  });

  it('case, spacing, separators and a BOM do not matter', () => {
    expect(suggestRawColumns(['  sku ', 'UNIT_COST', '﻿material-name'])).toEqual({ sku: 0, cost: 1, name: 2 });
  });

  it('the supported aliases', () => {
    expect(suggestRawColumns(['Item Code', 'Buy Price', 'Item Name'])).toEqual({ sku: 0, cost: 1, name: 2 });
    expect(suggestRawColumns(['Product Code', 'Unit Cost', 'Product Name'])).toEqual({ sku: 0, cost: 1, name: 2 });
    expect(suggestRawColumns(['Product SKU', 'Cost', 'Material Name'])).toEqual({ sku: 0, cost: 1, name: 2 });
  });

  it('the real Arabic template headers', () => {
    expect(suggestRawColumns(AR_RAW)).toEqual({ sku: 1, cost: 2, name: 0 });
  });

  it('the exact header beats an alias', () => {
    expect(suggestRawColumns(['Item Code', 'SKU', 'Buy Price', 'Cost'])).toEqual({ sku: 1, cost: 3, name: NO_COLUMN });
  });

  it('missing columns stay unmapped: nothing is invented', () => {
    expect(suggestRawColumns(['SKU', 'Name'])).toEqual({ sku: 0, cost: NO_COLUMN, name: 1 });
    expect(suggestRawColumns(['Code', 'Amount', 'Qty'])).toEqual({ sku: NO_COLUMN, cost: NO_COLUMN, name: NO_COLUMN });
    expect(suggestRawColumns([])).toEqual({ sku: NO_COLUMN, cost: NO_COLUMN, name: NO_COLUMN });
  });

  it('no guessing from content-like headers: numbers, partial words, near misses', () => {
    expect(suggestRawColumns(['SKU 2', 'Cost (old)', 'Names', 'Total cost', 'SKUs'])).toEqual({ sku: NO_COLUMN, cost: NO_COLUMN, name: NO_COLUMN });
  });

  it('ambiguous: two columns fit the best alias — nothing is chosen, not the first one', () => {
    expect(suggestRawColumns(['SKU', 'Name', 'sku', 'Cost'])).toEqual({ sku: NO_COLUMN, cost: 3, name: 1 });
    expect(suggestRawColumns(['SKU', 'Cost', 'COST'])).toEqual({ sku: 0, cost: NO_COLUMN, name: NO_COLUMN });
    // Ambiguity at the strongest level does not fall through to a weaker alias.
    expect(suggestRawColumns(['Cost', 'cost', 'Unit Cost'])).toEqual({ sku: NO_COLUMN, cost: NO_COLUMN, name: NO_COLUMN });
  });

  it('one column is never chosen for two fields', () => {
    expect(suggestColumn(['SKU'], 'sku', { taken: new Set([0]) })).toBe(NO_COLUMN);
  });
});

describe('suggestRetailColumn', () => {
  it('exact, alias, Arabic, any order, case', () => {
    expect(suggestRetailColumn(['Name', 'SKU', 'Retail Price', 'Unit'], 4)).toBe(2);
    expect(suggestRetailColumn(['selling_price', 'Name', 'SKU', 'Unit'], 4)).toBe(0);
    expect(suggestRetailColumn(AR_COMP, 4)).toBe(3);
    expect(suggestRetailColumn(['Name', 'SKU', 'PRICE', 'Unit'], 4)).toBe(2);
  });

  it('the exact header beats the bare "Price" alias', () => {
    expect(suggestRetailColumn(['Price', 'SKU', 'Retail Price', 'Unit'], 4)).toBe(2);
  });

  it('missing → unmapped; ambiguous → unmapped', () => {
    expect(suggestRetailColumn(['Name', 'SKU', 'Category', 'Unit'], 4)).toBe(NO_COLUMN);
    expect(suggestRetailColumn(['Retail Price', 'SKU', 'retail price', 'Unit'], 4)).toBe(NO_COLUMN);
  });

  it('only among the fixed columns (the export ignores a Retail Price among the ingredient pairs)', () => {
    expect(suggestRetailColumn(['Name', 'SKU', 'Cat', 'Unit', 'Retail Price'], 4)).toBe(NO_COLUMN);
    expect(suggestRetailColumn(['Name', 'SKU', 'Cat', 'Unit', 'Retail Price'], 5)).toBe(4);
  });
});

describe('nextChoice: manual choices are kept, stale ones are not', () => {
  it('a manual choice survives a recompute on the same sheet', () => {
    expect(nextChoice(manualChoice(2), 0, false, 5)).toEqual(manualChoice(2));
    // …including a deliberate "none".
    expect(nextChoice(manualChoice(-1), 0, false, 5)).toEqual(manualChoice(-1));
  });

  it('an automatic choice is simply recomputed', () => {
    expect(nextChoice(autoChoice(2), 0, false, 5)).toEqual(autoChoice(0));
    expect(nextChoice(autoChoice(2), NO_COLUMN, false, 5)).toEqual(autoChoice(NO_COLUMN));
  });

  it('another sheet or file: the new default replaces even a manual choice', () => {
    expect(nextChoice(manualChoice(2), 1, true, 5)).toEqual(autoChoice(1));
    expect(nextChoice(manualChoice(2), NO_COLUMN, true, 5)).toEqual(autoChoice(NO_COLUMN));
  });

  it('a manual choice whose column no longer exists is not kept', () => {
    expect(nextChoice(manualChoice(7), 1, false, 5)).toEqual(autoChoice(1));
  });
});
