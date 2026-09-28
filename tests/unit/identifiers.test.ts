import { describe, it, expect } from 'vitest';
import { identifierKey, nextFreeSuffix, resolveBarcodes } from '../../utils/identifiers';

// Built from code points so no invisible character sits in this file.
const ch = (cp: number) => String.fromCharCode(cp);
const KASRA = ch(0x0650);
const FATHA = ch(0x064e);
const SHADDA = ch(0x0651);
const TATWEEL = ch(0x0640);
const ZWSP = ch(0x200b);
const ZWJ = ch(0x200d);
const LRM = ch(0x200e);
const RLM = ch(0x200f);
const BOM = ch(0xfeff);
const NBSP = ch(0x00a0);
const DOTTED_CIRCLE_MARK = ch(0x0301); // a combining acute accent; shown as a dotted circle with no base

describe('identifierKey — invisible marks are ignored', () => {
  it('THE REPORTED CASE: a barcode with a trailing kasra is the same barcode', () => {
    expect(identifierKey(`6287013210006${KASRA}`)).toBe('6287013210006');
    expect(identifierKey(`6287013210006${KASRA}`)).toBe(identifierKey('6287013210006'));
  });

  it('the second reported case: a stray combining mark rendered as a dotted circle', () => {
    expect(identifierKey(`6000123107826${DOTTED_CIRCLE_MARK}`)).toBe('6000123107826');
  });

  it.each([
    ['zero-width space', ZWSP], ['zero-width joiner', ZWJ],
    ['left-to-right mark', LRM], ['right-to-left mark', RLM],
    ['byte-order mark', BOM], ['tatweel', TATWEEL],
  ])('ignores a %s, wherever it sits', (_name, c) => {
    expect(identifierKey(`${c}SKU${c}-${c}42${c}`)).toBe('SKU-42');
  });

  it('strips Arabic diacritics but keeps the letters', () => {
    expect(identifierKey(`ش${FATHA}ا${SHADDA}ي`)).toBe('شاي');
  });

  it('trims ordinary and non-breaking spaces at the ends', () => {
    expect(identifierKey(`  ${NBSP}ABC${NBSP} `)).toBe('ABC');
  });
});

describe('identifierKey — what it deliberately does NOT change (D7)', () => {
  it('LEADING ZEROS ARE SIGNIFICANT: 00123 is not 123', () => {
    expect(identifierKey('00123')).not.toBe(identifierKey('123'));
    expect(identifierKey('00123')).toBe('00123');
  });

  it('visible punctuation is significant: X-1 is not X1', () => {
    // If hyphens were stripped, resolving a duplicate to `X-1` could collide
    // with an existing `X1` — the resolver would create duplicates.
    expect(identifierKey('X-1')).not.toBe(identifierKey('X1'));
    expect(identifierKey('A_B')).not.toBe(identifierKey('AB'));
    expect(identifierKey('A|B')).not.toBe(identifierKey('AB'));
  });

  it('case is significant: identifiers are exact text', () => {
    expect(identifierKey('abc')).not.toBe(identifierKey('ABC'));
  });

  it('a value that is ONLY invisible characters has an empty key', () => {
    expect(identifierKey(`${ZWSP}${KASRA}`)).toBe('');
  });

  it('handles non-strings', () => {
    expect(identifierKey(123)).toBe('123');
    expect(identifierKey(null)).toBe('');
    expect(identifierKey(undefined)).toBe('');
  });
});

describe('nextFreeSuffix', () => {
  it('starts at -1', () => {
    expect(nextFreeSuffix('X', new Set(['X']))).toBe('X-1');
  });

  it('skips a suffix already present in the file', () => {
    // The bug it fixes: `X`, `X` → `X`, `X-1` even when `X-1` already existed.
    expect(nextFreeSuffix('X', new Set(['X', 'X-1']))).toBe('X-2');
  });

  it('records what it hands out, so two calls never collide', () => {
    const taken = new Set(['X']);
    expect([nextFreeSuffix('X', taken), nextFreeSuffix('X', taken)]).toEqual(['X-1', 'X-2']);
    expect(taken.has('X-2')).toBe(true);
  });
});

describe('resolveBarcodes', () => {
  it('duplicate barcode: the first holder keeps it, later rows get -1, -2', () => {
    const fixes = resolveBarcodes(new Map([['B', [1, 4, 7]]]), new Set(), new Set(['B']));
    expect(fixes).toEqual([
      { rowIndex: 4, key: 'B', newValue: 'B-1', reason: 'duplicate' },
      { rowIndex: 7, key: 'B', newValue: 'B-2', reason: 'duplicate' },
    ]);
  });

  it('cross-column: a barcode equal to an SKU is renamed, because the SKU owns the code', () => {
    const fixes = resolveBarcodes(new Map([['C', [2]]]), new Set(['C']), new Set(['C']));
    expect(fixes).toEqual([{ rowIndex: 2, key: 'C', newValue: 'C-1', reason: 'cross-column' }]);
  });

  it('cross-column AND duplicated: every barcode row is renamed, the first included', () => {
    const fixes = resolveBarcodes(new Map([['C', [2, 5]]]), new Set(['C']), new Set(['C']));
    expect(fixes.map((f) => [f.rowIndex, f.newValue])).toEqual([[2, 'C-1'], [5, 'C-2']]);
  });

  it('never assigns a value already present elsewhere in the file', () => {
    const taken = new Set(['B', 'B-1', 'B-2']); // e.g. SKUs or barcodes that already exist
    const fixes = resolveBarcodes(new Map([['B', [0, 1]]]), new Set(), taken);
    expect(fixes[0].newValue).toBe('B-3');
  });

  it('a unique barcode with no SKU clash is left alone', () => {
    expect(resolveBarcodes(new Map([['U', [3]]]), new Set(), new Set(['U']))).toEqual([]);
  });

  it('END TO END on the reported values: kasra variant is caught and renamed', () => {
    const cells = ['6287013210006', `6287013210006${KASRA}`, '00123', '123'];
    const groups = new Map<string, number[]>();
    cells.forEach((v, row) => {
      const k = identifierKey(v);
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k)!.push(row);
    });
    const fixes = resolveBarcodes(groups, new Set(), new Set(groups.keys()));
    // The kasra row is a duplicate of row 0; the leading-zero pair is NOT (D7).
    expect(fixes).toEqual([{ rowIndex: 1, key: '6287013210006', newValue: '6287013210006-1', reason: 'duplicate' }]);
  });
});
