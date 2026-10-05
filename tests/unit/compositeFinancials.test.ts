import { describe, it, expect } from 'vitest';
import {
  parseAmount, legacyAmount, compositeCost, profitOf, marginPercentOf, profitStatus, costExceedsRetail,
  financialsEnabled, buildCostIndex, productFinancials, profitSheetRows, bomSheetRows, financialSummary,
  PROFIT_HEADER, BOM_HEADER, NOT_MAPPED, MARGIN_NEEDS_RETAIL_NOTE, type FinancialMapping,
} from '../../utils/compositeFinancials';

/**
 * Cost & Profit for Composite Check. The formula is the Cost & Profit
 * Analyzer's (Σ unit cost × qty; Profit = Retail − Cost; Margin = Profit ÷
 * Retail); the validated export reads it strictly.
 */

// Raw sheet: SKU | Name | Cost.  Composite: Name | SKU | Retail | Unit | (Ing SKU, Qty)…
const MAP: FinancialMapping = { rawSkuCol: 0, costCol: 2, rawNameCol: 1, retailPriceCol: 2 };
const RAW = [
  ['RAW-1', 'Bun', 1],
  ['RAW-2', 'Patty', '5'],
  ['RAW-3', 'Cheese', '2.50'],
  ['00123', 'Sauce', 0.5],
  ['123', 'Other sauce', 9],
  ['RAW-EMPTY', 'No cost', ''],
  ['RAW-BAD', 'Bad cost', 'abc'],
  ['RAW-NEG', 'Neg cost', '-2'],
  ['RAW-DUP', 'Dup A', 3],
  ['RAW-DUP', 'Dup B', 4],
  ['RAW-SAME', 'Same A', 2],
  ['RAW-SAME', 'Same B', '2'],
];
const index = buildCostIndex(RAW, MAP);
const fin = (row: unknown[], m: FinancialMapping = MAP) => productFinancials(row, 4, index, m);

describe('parseAmount (strict) and legacyAmount (the analyzer\'s reading)', () => {
  it.each([
    [12, { kind: 'ok', value: 12 }],
    ['12.50', { kind: 'ok', value: 12.5 }],
    [' 7 ', { kind: 'ok', value: 7 }],
    ['1,250.75', { kind: 'ok', value: 1250.75 }],
    ['-3', { kind: 'ok', value: -3 }],
    [0, { kind: 'ok', value: 0 }],
    ['', { kind: 'empty' }],
    [null, { kind: 'empty' }],
    [undefined, { kind: 'empty' }],
    ['abc', { kind: 'invalid', text: 'abc' }],
    ['12 SAR', { kind: 'invalid', text: '12 SAR' }],
    ['1.2.3', { kind: 'invalid', text: '1.2.3' }],
    ['0x10', { kind: 'invalid', text: '0x10' }],
    ['12,5', { kind: 'invalid', text: '12,5' }],
    [Infinity, { kind: 'invalid', text: 'Infinity' }],
  ])('parseAmount(%j)', (raw, out) => expect(parseAmount(raw)).toEqual(out));

  it('legacyAmount is the analyzer\'s original expression, character for character', () => {
    const original = (v: unknown) => parseFloat(String(v || '0').replace(/[^0-9.]/g, '')) || 0;
    for (const v of [12, '12.50', 'abc', '', null, undefined, '-3', '12 SAR', '1,250', 0, '1.2.3']) {
      expect(legacyAmount(v)).toBe(original(v));
    }
  });
});

describe('the formula', () => {
  it('cost = Σ unit cost × qty; profit = retail − cost; margin in percent', () => {
    expect(compositeCost([{ unitCost: 1, qty: 2 }, { unitCost: 5, qty: 1.5 }])).toBe(9.5);
    expect(compositeCost([])).toBe(0);
    expect(profitOf(20, 9.5)).toBe(10.5);
    expect(marginPercentOf(20, 10.5)).toBe(52.5);
    expect(marginPercentOf(0, -3)).toBe(0);
  });

  it('profit status: positive, zero (with floating noise), negative', () => {
    expect(profitStatus(0.01)).toBe('Profit');
    expect(profitStatus(0)).toBe('Break-even');
    expect(profitStatus(0.1 + 0.2 - 0.3)).toBe('Break-even');
    expect(profitStatus(-0.01)).toBe('Loss');
    expect(costExceedsRetail(10.000000000001, 10)).toBe(false);
    expect(costExceedsRetail(10.01, 10)).toBe(true);
  });
});

describe('mapping', () => {
  it('financials need Raw SKU and Cost; Name and Retail Price are optional', () => {
    expect(financialsEnabled(MAP)).toBe(true);
    expect(financialsEnabled({ ...MAP, rawNameCol: NOT_MAPPED, retailPriceCol: NOT_MAPPED })).toBe(true);
    expect(financialsEnabled({ ...MAP, rawSkuCol: NOT_MAPPED })).toBe(false);
    expect(financialsEnabled({ ...MAP, costCol: NOT_MAPPED })).toBe(false);
  });

  it('the cost index: SKU keys, raw row numbers, duplicates split into conflicts and repeats', () => {
    expect(index.entries.get('RAW-1')).toEqual({ sku: 'RAW-1', cost: { kind: 'ok', value: 1 }, name: 'Bun', row: 2 });
    expect(index.conflicts.get('RAW-DUP')!.map((e) => e.row)).toEqual([10, 11]);
    expect(index.repeats.has('RAW-SAME')).toBe(true);
    expect(index.conflicts.has('RAW-SAME')).toBe(false);
  });

  it('without a Name column, names are blank', () => {
    expect(buildCostIndex(RAW, { ...MAP, rawNameCol: NOT_MAPPED }).entries.get('RAW-1')!.name).toBe('');
  });
});

describe('productFinancials', () => {
  it('a positive profit', () => {
    const p = fin(['Burger', 'COMP-1', 20, 'pc', 'RAW-1', '2', 'RAW-2', '1.5']);
    expect(p).toMatchObject({ name: 'Burger', sku: 'COMP-1', cost: 9.5, retailPrice: 20, profit: 10.5, margin: 0.525, status: 'Profit', issues: [], note: '' });
    expect(p.lines).toEqual([
      { sku: 'RAW-1', name: 'Bun', qty: 2, unitCost: 1, lineCost: 2 },
      { sku: 'RAW-2', name: 'Patty', qty: 1.5, unitCost: 5, lineCost: 7.5 },
    ]);
  });

  it('break-even: zero profit, not an error', () => {
    const p = fin(['Even', 'COMP-2', '7', 'pc', 'RAW-1', '2', 'RAW-2', '1']);
    expect(p).toMatchObject({ cost: 7, profit: 0, margin: 0, status: 'Break-even', issues: [] });
  });

  it('Cost above Retail Price: a loss AND a validation error naming both values and the loss', () => {
    const p = fin(['Loser', 'COMP-3', '10', 'pc', 'RAW-2', '2', 'RAW-3', '1']);
    expect(p).toMatchObject({ cost: 12.5, retailPrice: 10, profit: -2.5, margin: -0.25, status: 'Loss' });
    expect(p.issues).toEqual([{
      message: 'Cost is higher than Retail Price (Cost 12.50 > Retail Price 10.00, loss 2.50)',
      arabic: 'التكلفة أعلى من سعر البيع (التكلفة 12.50 > سعر البيع 10.00، الخسارة 2.50)',
      col: 2,
    }]);
  });

  it('several products, each on its own', () => {
    const rows = [
      ['A', 'C-A', 5, 'pc', 'RAW-1', '1'],
      ['B', 'C-B', 1, 'pc', 'RAW-1', '1'],
      ['C', 'C-C', 0.5, 'pc', 'RAW-1', '1'],
    ];
    expect(rows.map((r) => fin(r).status)).toEqual(['Profit', 'Break-even', 'Loss']);
  });

  it('missing Cost in the Raw sheet: no cost, no profit, an error on the ingredient', () => {
    const p = fin(['X', 'C-X', 20, 'pc', 'RAW-1', '1', 'RAW-EMPTY', '1']);
    expect(p).toMatchObject({ cost: null, profit: null, margin: null, status: null });
    expect(p.issues).toEqual([{ message: "Missing Cost for Ingredient 'RAW-EMPTY'", arabic: "التكلفة مفقودة للمكون 'RAW-EMPTY'", col: 6 }]);
    expect(p.note).toBe('A cost in the Raw sheet is missing or unusable');
  });

  it('invalid and negative costs are reported, never read as 0', () => {
    expect(fin(['X', 'C', 20, 'pc', 'RAW-BAD', '1']).issues[0].message).toBe("Invalid Cost 'abc' for Ingredient 'RAW-BAD'");
    expect(fin(['X', 'C', 20, 'pc', 'RAW-NEG', '1']).issues[0].message).toBe("Negative Cost '-2' for Ingredient 'RAW-NEG'");
    expect(fin(['X', 'C', 20, 'pc', 'RAW-BAD', '1']).cost).toBeNull();
  });

  it('a duplicate Raw SKU with different costs is an error; with the same cost it is used', () => {
    const conflict = fin(['X', 'C', 20, 'pc', 'RAW-DUP', '1']);
    expect(conflict.cost).toBeNull();
    expect(conflict.issues[0].message).toBe("Conflicting Cost for Ingredient 'RAW-DUP' (Raw rows 10, 11)");
    expect(fin(['X', 'C', 20, 'pc', 'RAW-SAME', '3'])).toMatchObject({ cost: 6, issues: [] });
  });

  it('missing and invalid Retail Price: errors, no profit; the cost is still shown', () => {
    const missing = fin(['X', 'C', '', 'pc', 'RAW-1', '2']);
    expect(missing).toMatchObject({ cost: 2, retailPrice: null, profit: null, status: null });
    expect(missing.issues).toEqual([{ message: 'Missing Retail Price', arabic: 'سعر البيع مفقود', col: 2 }]);
    expect(fin(['X', 'C', 'free', 'pc', 'RAW-1', '2']).issues[0].message).toBe("Invalid Retail Price 'free'");
    expect(fin(['X', 'C', '-5', 'pc', 'RAW-1', '2']).issues[0]).toEqual({ message: "Negative Retail Price '-5'", arabic: "سعر البيع بالسالب '-5'", col: 2 });
  });

  it('a Retail Price problem: Profit and Margin blank, and the Note gives the same reason as Validation Errors', () => {
    const cases: [unknown, string][] = [
      ['', 'Missing Retail Price'],
      ['free', "Invalid Retail Price 'free'"],
      ['-5', "Negative Retail Price '-5'"],
    ];
    for (const [retail, reason] of cases) {
      const p = fin(['X', 'C', retail, 'pc', 'RAW-1', '2']);
      // Cost is unaffected; nothing is turned into 0.
      expect(p).toMatchObject({ cost: 2, retailPrice: null, profit: null, margin: null, status: null, note: reason });
      expect(p.issues.map((i) => i.message)).toEqual([reason]);
    }
  });

  it('a Retail Price of 0: valid, Profit calculated, Margin blank, and the Note says why', () => {
    const p = fin(['Free', 'C', 0, 'pc', 'RAW-1', '2']);
    expect(p).toMatchObject({ cost: 2, retailPrice: 0, profit: -2, margin: null, status: 'Loss', note: MARGIN_NEEDS_RETAIL_NOTE });
    // Not a Retail Price error: the only issue is the existing Cost above Retail Price rule.
    expect(p.issues.map((i) => i.message)).toEqual(['Cost is higher than Retail Price (Cost 2.00 > Retail Price 0.00, loss 2.00)']);
    // Break-even at 0: still a Profit figure, still no Margin, same Note, no error.
    const even = fin(['Gift', 'C', '0', 'pc']);
    expect(even.cost).toBeNull(); // no ingredients: the cost reason wins, as before
    const zeroCost = productFinancials(['Z', 'C', 0, 'pc', 'RAW-Z', '1'], 4, buildCostIndex([['RAW-Z', 'Zero', 0]], MAP), MAP);
    expect(zeroCost).toMatchObject({ cost: 0, retailPrice: 0, profit: 0, margin: null, status: 'Break-even', issues: [], note: MARGIN_NEEDS_RETAIL_NOTE });
    expect(MARGIN_NEEDS_RETAIL_NOTE).toBe('Margin cannot be calculated because Retail Price is 0');
  });

  it('cost unknown AND a Retail Price problem: the Note gives both reasons', () => {
    expect(fin(['X', 'C', '', 'pc', 'RAW-EMPTY', '1']).note).toBe('A cost in the Raw sheet is missing or unusable; Missing Retail Price');
  });

  it('a usable Retail Price and a known cost: no Note', () => {
    expect(fin(['X', 'C', 20, 'pc', 'RAW-1', '2']).note).toBe('');
    expect(fin(['X', 'C', 1, 'pc', 'RAW-2', '2']).note).toBe(''); // a loss still has a profit figure
  });

  it('Retail Price not mapped: cost only, no profit, no error, a note', () => {
    const p = fin(['X', 'C', 20, 'pc', 'RAW-1', '2'], { ...MAP, retailPriceCol: NOT_MAPPED });
    expect(p).toMatchObject({ cost: 2, retailPrice: null, profit: null, status: null, issues: [], note: 'Retail Price is not mapped' });
  });

  it('an ingredient not in the Raw sheet blanks the cost (the structure check reports it)', () => {
    const p = fin(['X', 'C', 20, 'pc', 'RAW-1', '1', 'NOPE', '1']);
    expect(p).toMatchObject({ cost: null, profit: null, issues: [] });
    expect(p.note).toBe("Ingredient 'NOPE' is not in the Raw sheet");
  });

  it('an unusable quantity blanks the cost (the structure check reports it)', () => {
    expect(fin(['X', 'C', 20, 'pc', 'RAW-1', 'two'])).toMatchObject({ cost: null, issues: [] });
    expect(fin(['X', 'C', 20, 'pc', 'RAW-1', '0']).cost).toBeNull();
  });

  it('no ingredients: no cost is invented', () => {
    expect(fin(['X', 'C', 20, 'pc'])).toMatchObject({ cost: null, profit: null, note: 'No ingredients' });
  });

  it('the margin fraction is profit / retail exactly, not percent / 100', () => {
    expect(fin(['Saucy', 'C', 3, 'pc', '00123', '2']).margin).toBe(2 / 3);
  });

  it('leading zeros are significant (D7): 00123 and 123 are different SKUs', () => {
    expect(fin(['X', 'C', 20, 'pc', '00123', '2']).cost).toBe(1);
    expect(fin(['X', 'C', 20, 'pc', '123', '2']).cost).toBe(18);
  });

  it('invisible characters are ignored, case is kept (D7)', () => {
    expect(fin(['X', 'C', 20, 'pc', `RAW-1${String.fromCharCode(0x200b)} `, '1']).cost).toBe(1);
    expect(fin(['X', 'C', 20, 'pc', 'raw-1', '1']).cost).toBeNull();
  });
});

describe('the export sheets', () => {
  const products = [
    fin(['Burger', 'COMP-1', 20, 'pc', 'RAW-1', '2', 'RAW-2', '1.5']),
    fin(['Loser', 'COMP-3', '10', 'pc', 'RAW-2', '2', 'RAW-3', '1']),
    fin(['Empty', 'COMP-9', 5, 'pc']),
    fin(['NoPrice', 'COMP-7', 'n/a', 'pc', 'RAW-1', '3']),
  ];

  it('Profit Analysis: numbers stay numbers, unknowns stay blank', () => {
    expect(profitSheetRows(products, [2, 3, 4, 5])).toEqual([
      [...PROFIT_HEADER],
      ['Burger', 'COMP-1', 20, 9.5, 10.5, 0.525, 'Profit', 2, ''],
      ['Loser', 'COMP-3', 10, 12.5, -2.5, -0.25, 'Loss', 3, ''],
      ['Empty', 'COMP-9', 5, '', '', '', '', 4, 'No ingredients'],
      // The cost stays a number; Retail Price, Profit and Margin stay blank, with the reason.
      ['NoPrice', 'COMP-7', '', 3, '', '', '', 5, "Invalid Retail Price 'n/a'"],
    ]);
  });

  it('Detailed BOM: one line per ingredient, as the analyzer lays it out', () => {
    expect(bomSheetRows(products)).toEqual([
      [...BOM_HEADER],
      ['Burger', 'COMP-1', 'RAW-1', 'Bun', 2, 1, 2],
      ['Burger', 'COMP-1', 'RAW-2', 'Patty', 1.5, 5, 7.5],
      ['Loser', 'COMP-3', 'RAW-2', 'Patty', 2, 5, 10],
      ['Loser', 'COMP-3', 'RAW-3', 'Cheese', 1, 2.5, 2.5],
      ['Empty', 'COMP-9', '(No Ingredients)', '', '', '', ''],
      ['NoPrice', 'COMP-7', 'RAW-1', 'Bun', 3, 1, 3],
    ]);
  });

  it('the summary counts', () => {
    expect(financialSummary(products)).toEqual({ products: 4, withProfit: 1, breakEven: 0, withLoss: 1, costUnknown: 1, costAboveRetail: 1 });
  });
});
