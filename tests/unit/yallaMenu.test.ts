import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { yallaMenuSource, yallaMenuText, fetchYallaMenu, type YallaDetail } from '../../utils/yallaMenu';

/** Real data from kelah.yallaqrcodes.com (2026-09-29), trimmed — see the fixture's `_source`. */
const FX = JSON.parse(readFileSync(new URL('../fixtures/yalla-kelah.json', import.meta.url), 'utf-8'));
const CATS = FX.categories.data;
const ITEMS = FX.items.data;
const DETAILS = new Map<number, YallaDetail>(Object.entries(FX.details).map(([id, v]: [string, any]) => [Number(id), v.data]));
const PAGE = 'https://kelah.yallaqrcodes.com/branch/1/';

const lines = () => yallaMenuText(CATS, ITEMS, DETAILS, PAGE).text.split('\n');
const lineFor = (s: string) => lines().filter((l) => l.includes(s));

describe('yallaMenuSource', () => {
  it.each([
    [PAGE, { origin: 'https://kelah.yallaqrcodes.com', branch: '1' }],
    ['https://kelah.yallaqrcodes.com/branch/12', { origin: 'https://kelah.yallaqrcodes.com', branch: '12' }],
    ['https://other-cafe.yallaqrcodes.com/', { origin: 'https://other-cafe.yallaqrcodes.com' }],
  ])('%s → the platform JSON', (url, src) => {
    expect(yallaMenuSource(url)).toEqual(src);
  });

  it.each([
    'https://example.com/menu', 'http://kelah.yallaqrcodes.com/branch/1/', 'https://yallaqrcodes.com/',
    'https://kelah.yallaqrcodes.com.evil.test/', 'https://evil.test/?u=kelah.yallaqrcodes.com', 'not a url',
  ])('%s is NOT on the platform', (url) => {
    expect(yallaMenuSource(url)).toBeNull();
  });
});

describe('yallaMenuText — the items the page listed without a price', () => {
  it('REPRODUCTION: شاي أحمر becomes one row per size, with its real prices', () => {
    // The page shows "شاي أحمر" with no price; its sizes only appear when opened.
    expect(lineFor('شاي أحمر')).toEqual([
      expect.stringMatching(/^- VARIANT شاي أحمر \| Option 1: الحجم \| Option 1 Value: كوب \| Price: 4\.00/),
      expect.stringMatching(/^- VARIANT شاي أحمر \| Option 1: الحجم \| Option 1 Value: إبريق صغير \| Price: 15\.00/),
      expect.stringMatching(/^- VARIANT شاي أحمر \| Option 1: الحجم \| Option 1 Value: إبريق كبير \| Price: 20\.00/),
    ]);
  });

  it('a pizza with no base price gets its size prices', () => {
    expect(lineFor('مارجريتا').map((l) => /Value: (\S+) \| Price: ([\d.]+)/.exec(l)!.slice(1))).toEqual([['وسط', '27.00'], ['كبير', '37.00']]);
  });

  it('option prices are FULL prices, not surcharges: ديناميت دجاج 22 → صغير 18 / كبير 22', () => {
    expect(lineFor('ديناميت دجاج').map((l) => /Value: (\S+) \| Price: ([\d.]+)/.exec(l)!.slice(1))).toEqual([['صغير', '18.00'], ['كبير', '22.00']]);
  });

  it('a choice that costs nothing extra keeps the item price: كيمكس حار / بارد at 15', () => {
    expect(lineFor('كيمكس').map((l) => /Value: (\S+) \| Price: ([\d.]+)/.exec(l)!.slice(1))).toEqual([['حار', '15.00'], ['بارد', '15.00']]);
  });

  it('a daily meal whose dishes are the options: one row per dish at its own price', () => {
    const rows = lineFor('الوجبة اليومية 150 جرام');
    expect(rows.length).toBeGreaterThan(1);
    expect(rows.every((l) => l.startsWith('- VARIANT ') && /Price: [1-9]\d*\.00/.test(l))).toBe(true);
  });

  it('a plain priced item is one ordinary line', () => {
    expect(lineFor('شاي أخضر')).toEqual([expect.stringMatching(/^- شاي أخضر \| Price: 4\.00/)]);
  });

  it('an item with NO price anywhere is marked, never given a guessed price', () => {
    // `^- ` — the name also occurs inside a daily-meal option (`وجبة كاري دجاج`).
    expect(lines().filter((l) => l.startsWith('- وجبة كاري |'))).toEqual([expect.stringContaining('Price: (no price listed on the menu)')]);
  });

  it('sections come in the menu order, headed by their names', () => {
    const heads = lines().filter((l) => l.startsWith('## '));
    expect(heads[0]).toBe('## المشروبات الساخنة');
  });

  it('counts what it did', () => {
    const { stats } = yallaMenuText(CATS, ITEMS, DETAILS, PAGE);
    expect(stats).toEqual({ items: 8, withVariants: 5, variantRows: expect.any(Number), noPrice: 1 });
    expect(stats.variantRows).toBeGreaterThanOrEqual(3 + 2 + 2 + 2 + 2);
  });

  it('an OPTIONAL modifier is an add-on on the item, not a set of variant rows', () => {
    const details = new Map<number, YallaDetail>([[128, { modifiers: [
      { name_ar: 'شاي أخضر - إضافات', min_options: 0, max_options: null, options: [{ name_ar: 'عسل', price: 2 }] },
    ] }]]);
    expect(yallaMenuText(CATS, ITEMS, details).text.split('\n').filter((l) => l.includes('شاي أخضر')))
      .toEqual([expect.stringMatching(/^- شاي أخضر \| Price: 4\.00 .*Add-ons \(optional, not separate rows\): إضافات: عسل \+2\.00$/)]);
  });

  it('deleted and unavailable items and options are left out', () => {
    const items = ITEMS.map((i: any) => (i.name_ar === 'كرك' ? { ...i, available: false } : i));
    const details = new Map(DETAILS);
    details.set(127, { modifiers: [{ ...DETAILS.get(127)!.modifiers![0], options: DETAILS.get(127)!.modifiers![0].options!.map((o, k) => (k === 1 ? { ...o, is_deleted: true } : o)) }] });
    const text = yallaMenuText(CATS, items, details).text;
    expect(text).not.toContain('كرك');
    expect(text).not.toContain('إبريق صغير');
    expect(text).toContain('إبريق كبير');
  });
});

describe('yallaMenuText — review findings (2f16972)', () => {
  const item = (over: Record<string, unknown>) => ({ id: 900, category: CATS[0].id, price: 0, available: true, is_deleted: false, sort_order: 99, name_ar: 'صنف تجريبي', ...over });
  const sizes = (options: Record<string, unknown>[]) =>
    new Map<number, YallaDetail>([[900, { modifiers: [{ name_ar: 'صنف تجريبي - الحجم', min_options: 1, max_options: 1, options }] }]]);
  const linesOf = (items: any[], details: Map<number, YallaDetail>) =>
    yallaMenuText(CATS, items, details).text.split(/\r?\n/).filter((l) => l.includes('صنف تجريبي'));

  it('an item whose required options are ALL unavailable is still listed, not dropped', () => {
    const out = linesOf([item({ price: 12 })], sizes([{ name_ar: 'صغير', price: 10, available: false }, { name_ar: 'كبير', price: 14, is_deleted: true }]));
    expect(out).toEqual([expect.stringMatching(/^- صنف تجريبي \| Price: 12\.00/)]);
  });

  it('a variant with no price on the option OR the item is marked, never "0.00"', () => {
    const out = linesOf([item({ price: 0 })], sizes([{ name_ar: 'حار', price: 0 }, { name_ar: 'بارد', price: 0 }]));
    expect(out).toHaveLength(2);
    expect(out.every((l) => l.includes('Price: (no price listed on the menu)'))).toBe(true);
    expect(out.join(' ')).not.toContain('0.00');
    expect(yallaMenuText(CATS, [item({ price: 0 })], sizes([{ name_ar: 'حار', price: 0 }])).stats.noPrice).toBe(1);
  });

  it('an item whose section is missing from the section list is kept, under its own heading', () => {
    const text = yallaMenuText(CATS, [item({ category: 424242, price: 9 })], new Map()).text;
    expect(text).toContain('## (no section)');
    expect(text).toContain('- صنف تجريبي | Price: 9.00');
  });
});

describe('fetchYallaMenu', () => {
  const fakeFetch = (fail: (url: string) => boolean = () => false) => {
    const calls: { url: string; branch?: string }[] = [];
    const fn = async (url: string, init?: { headers?: Record<string, string> }) => {
      calls.push({ url, branch: init?.headers?.branch });
      if (fail(url)) return { ok: false, status: 500, json: async () => ({}) };
      const path = new URL(url).pathname;
      const body = path === '/api/categories/' ? FX.categories
        : path === '/api/items-light/' ? FX.items
        : FX.details[/\/api\/items\/(\d+)\//.exec(path)![1]];
      return { ok: true, status: 200, json: async () => body };
    };
    return { fn, calls };
  };

  it('reads the sections, the items and EVERY item’s options, sending the branch header', async () => {
    const { fn, calls } = fakeFetch();
    const { text, stats, failedDetails } = await fetchYallaMenu(yallaMenuSource(PAGE)!, PAGE, fn);
    expect(failedDetails).toBe(0);
    expect(stats.withVariants).toBe(5);
    expect(text).toContain('Option 1 Value: إبريق صغير | Price: 15.00');
    expect(calls.filter((c) => c.url.includes('/api/items/'))).toHaveLength(ITEMS.length);
    expect(calls.every((c) => c.branch === '1')).toBe(true);
  });

  it('a failed item detail leaves that item without variants instead of failing the scrape', async () => {
    const { fn } = fakeFetch((u) => u.endsWith('/api/items/127/'));
    const { text, failedDetails } = await fetchYallaMenu(yallaMenuSource(PAGE)!, PAGE, fn);
    expect(failedDetails).toBe(1);
    expect(text).toContain('- شاي أحمر | Price: (no price listed on the menu)');
  });

  it('a failed listing throws, so the caller can fall back to the page text', async () => {
    const { fn } = fakeFetch((u) => u.endsWith('/api/items-light/'));
    await expect(fetchYallaMenu(yallaMenuSource(PAGE)!, PAGE, fn)).rejects.toThrow(/items-light.*500/);
  });
});
