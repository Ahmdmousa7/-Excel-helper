import { describe, it, expect } from 'vitest';
import { errorCategory, fixCategory, sheetNameFor, groupIssues } from '../../utils/issueSheets';

describe('errorCategory — one category per KIND of error, not per row', () => {
  it('drops the leading [Column]: prefix', () => {
    expect(errorCategory('[Product Name]: Empty Name')).toBe('Empty Name');
    expect(errorCategory('[Barcode]: Invalid characters')).toBe('Invalid characters');
  });

  it('Loss Alerts with different numbers are ONE category', () => {
    const a = errorCategory('Loss Alert: Cost (12.00) > Retail (10.00) (VAT Corrected)');
    const b = errorCategory('Loss Alert: Cost (99.50) > Retail (80.25) (VAT Corrected)');
    expect(a).toBe('Loss Alert');
    expect(b).toBe(a);
  });

  it('parenthesised detail is dropped', () => {
    expect(errorCategory(`[Tax Code]: Invalid Tax value (must be empty, 'S', or 'VATEX-SA-OOS')`)).toBe('Invalid Tax value');
  });

  it('quoted values are dropped, so different clashing names group together', () => {
    const a = errorCategory(`Category and Subcategory cannot have the same name ('Food')`);
    const b = errorCategory(`Category and Subcategory cannot have the same name ('Drinks')`);
    expect(a).toBe('Category and Subcategory cannot have the same name');
    expect(b).toBe(a);
  });

  it('the multi-quote category message groups across different values', () => {
    const a = errorCategory(`Subcategory 'Tea' was previously seen under Category 'Drinks'. It cannot belong to 'Food'.`);
    const b = errorCategory(`Subcategory 'Rice' was previously seen under Category 'Grains'. It cannot belong to 'Meat'.`);
    expect(b).toBe(a);
    expect(a).not.toMatch(/'/);
  });

  it('pack mismatches keep the pack number, so each pack is its own sheet', () => {
    expect(errorCategory('Pack 1 Mismatch: Label and Size must both be present or empty.')).toBe('Pack 1 Mismatch');
    expect(errorCategory('Pack 2 Mismatch: Label and Size must both be present or empty.')).toBe('Pack 2 Mismatch');
  });

  it('an empty message still yields a usable category', () => {
    expect(errorCategory('')).toBe('Other');
  });

  it('EVERY message format the validator emits collapses to a finite set', () => {
    // Each format from FileValidationTab, instantiated twice with different
    // detail. If any pair differs, that error would get one sheet per row.
    const formats = [
      (x: string) => `[${x}]: Empty Name`,
      (x: string) => `[${x}]: Invalid characters`,
      (x: string) => `[${x}]: Not a number`,
      (x: string) => `[${x}]: Invalid Boolean`,
      (x: string) => `[${x}]: Invalid Tax value (must be empty, 'S', or 'VATEX-SA-OOS')`,
      (x: string) => `Category and Subcategory cannot have the same name ('${x}')`,
      (x: string) => `Subcategory and Sub-Subcategory cannot have the same name ('${x}')`,
      (x: string) => `Category and Sub-Subcategory cannot have the same name ('${x}')`,
      (x: string) => `Subcategory ('${x}') requires a main Category`,
      (x: string) => `Subcategory '${x}' was previously seen under Category '${x}2'. It cannot belong to '${x}3'.`,
      (x: string) => `Sub-Subcategory ('${x}') requires a Subcategory`,
      (x: string) => `Sub-Subcategory '${x}' was previously seen under Subcategory '${x}2'. It cannot belong to '${x}3'.`,
      (x: string) => `Loss Alert: Cost (${x.length}.00) > Retail (${x.length - 1}.50) (VAT Corrected)`,
    ];
    for (const f of formats) expect(errorCategory(f('Alpha'))).toBe(errorCategory(f('Zeta-9')));
    expect(new Set(formats.map((f) => errorCategory(f('Alpha')))).size).toBe(formats.length);
  });
});

describe('fixCategory', () => {
  it('drops the field name in parentheses', () => {
    expect(fixCategory('Normalized Boolean (Sellable)')).toBe('Normalized Boolean');
    expect(fixCategory('Fixed Number Format (Retail Price)')).toBe('Fixed Number Format');
  });

  it('leaves fixed strings alone', () => {
    expect(fixCategory('Resolved Duplicate Barcode')).toBe('Resolved Duplicate Barcode');
    expect(fixCategory('Generated Missing Pack 2 SKU')).toBe('Generated Missing Pack 2 SKU');
  });
});

describe('sheetNameFor — always a name Excel accepts', () => {
  it('prefixes the category', () => {
    expect(sheetNameFor('Err_', 'Empty Name', new Set())).toBe('Err_Empty Name');
  });

  it('removes the characters Excel forbids', () => {
    expect(sheetNameFor('Err_', 'a/b\\c?d*e[f]g:h', new Set())).toBe('Err_a b c d e f g h');
  });

  it('never exceeds 31 characters', () => {
    const n = sheetNameFor('Err_', 'Category and Sub-Subcategory cannot have the same name', new Set());
    expect(n.length).toBeLessThanOrEqual(31);
  });

  it('two categories that truncate to the same name are made unique', () => {
    const used = new Set<string>();
    const a = sheetNameFor('Err_', 'Category and Subcategory cannot have the same name', used);
    const b = sheetNameFor('Err_', 'Category and Subcategory cannot share a parent', used);
    expect(a).not.toBe(b);
    expect(b.length).toBeLessThanOrEqual(31);
    expect(b).toMatch(/\(2\)$/);
  });

  it('avoids the workbook’s existing sheets, case-insensitively as Excel does', () => {
    const used = new Set(['validated data', 'change log', 'summary', 'suppliers']);
    expect(sheetNameFor('', 'Summary', used)).toBe('Summary (2)');
  });
});

describe('groupIssues', () => {
  const errors = [
    { rowIndex: 3, msg: 'Loss Alert: Cost (5.00) > Retail (4.00) (VAT Corrected)' },
    { rowIndex: 1, msg: '[Name]: Empty Name' },
    { rowIndex: 7, msg: 'Loss Alert: Cost (9.00) > Retail (2.00) (VAT Corrected)' },
    { rowIndex: 3, msg: '[Name]: Empty Name' },
  ];
  const actions = [[], ['Resolved Duplicate SKU'], [], ['Normalized Boolean (Sellable)', 'Normalized Boolean (Weighted)'], [], [], [], ['Resolved Duplicate Barcode']];

  it('one group per category, errors before fixes, categories sorted', () => {
    const groups = groupIssues(errors, actions);
    expect(groups.map((g) => `${g.kind}:${g.category}`)).toEqual([
      'error:Empty Name', 'error:Loss Alert',
      'fix:Normalized Boolean', 'fix:Resolved Duplicate Barcode', 'fix:Resolved Duplicate SKU',
    ]);
  });

  it('rows are ascending and appear once per category', () => {
    const groups = groupIssues(errors, actions);
    expect(groups.find((g) => g.category === 'Loss Alert')!.rows).toEqual([3, 7]);
    expect(groups.find((g) => g.category === 'Empty Name')!.rows).toEqual([1, 3]);
    // Two Normalized Boolean fixes on row 3 → row 3 listed once.
    expect(groups.find((g) => g.category === 'Normalized Boolean')!.rows).toEqual([3]);
  });

  it('inScope limits groups to one ZIP part, dropping categories with no rows in it', () => {
    const groups = groupIssues(errors, actions, (r) => r >= 0 && r < 4);
    expect(groups.find((g) => g.category === 'Loss Alert')!.rows).toEqual([3]);
    expect(groups.find((g) => g.category === 'Resolved Duplicate Barcode')).toBeUndefined();
  });

  it('no issues → no sheets', () => {
    expect(groupIssues([], [[], []])).toEqual([]);
  });
});
