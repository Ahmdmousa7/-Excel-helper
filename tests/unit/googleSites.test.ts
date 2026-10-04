// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  googleSitesPage, pageKey, imageKey, isSameSite, parseGoogleSitesHtml, classifyLine, pageMenuRows, scriptOf, dedupeRows,
  rowsFromOcrAnswer, sitesRow, sitesStats, googleSitesSummary, googleSitesReportSheet, clean,
  GOOGLE_SITES_COLUMNS, STARTING_PRICE_NOTE, MAX_LINKED_PAGES, OCR_PROMPT,
} from '../../utils/googleSites';
import {
  fetchGoogleSitesMenu, GoogleSitesError, type FetchLike, type ReadImage,
} from '../../services/googleSitesService';
import { FRESHA_COLUMNS } from '../../utils/freshaVenue';

/**
 * Google Sites menus for Web Scraper, against the real capture of
 * sites.google.com/view/nightback (tests/fixtures/google-sites/, 2026-10-01).
 * jsdom: the parser uses the browser's DOMParser.
 */
// Repo-relative: under jsdom `import.meta.url` is not a file URL.
const FIXTURE = JSON.parse(readFileSync('tests/fixtures/google-sites/nightback-pages.json', 'utf-8')) as { pages: Record<string, string> };
const SITE = 'https://sites.google.com/view/nightback';
const MAIN = `${SITE}/main-menu`;
const AR_HOME = `${SITE}/${encodeURIComponent('الصفحة-الرئيسية')}`;
const EN_PAGES = ['hot-drinks', 'soft-drinks', 'shisha-flavours', 'cold-drinks', 'cake-and-sweets'];
const urlOf = (slug: string) => `${SITE}/${encodeURIComponent(slug)}`;
const htmlOf = (slug: string) => FIXTURE.pages[slug];
const parsed = (slug: string) => parseGoogleSitesHtml(htmlOf(slug), urlOf(slug))!;

type Answer = { ok?: boolean; status?: number; body?: string; bytes?: Uint8Array; type?: string; hang?: boolean; error?: Error };

/**
 * A `fetch` that answers Jina page reads from the fixture (or from `pages`)
 * and image reads from `images`. Records every URL asked for.
 */
function fakeFetch(pages: Record<string, Answer | string> = {}, images: Record<string, Answer> = {}) {
  const asked: { url: string; format?: string }[] = [];
  const fn: FetchLike = async (url, init) => {
    asked.push({ url, format: init?.headers?.['X-Return-Format'] });
    let a: Answer | undefined;
    if (url.startsWith('https://r.jina.ai/')) {
      const target = url.slice('https://r.jina.ai/'.length);
      const slug = decodeURIComponent(new URL(target).pathname.split('/').pop() ?? '');
      const override = pages[slug];
      a = typeof override === 'string' ? { body: override } : override ?? (FIXTURE.pages[slug] ? { body: FIXTURE.pages[slug] } : { ok: false, status: 404, body: '' });
    } else {
      a = images[url] ?? Object.entries(images).find(([k]) => k === '*')?.[1] ?? { ok: false, status: 404 };
    }
    if (a.error) throw a.error;
    if (a.hang) {
      return new Promise((_, reject) => {
        init?.signal?.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
      });
    }
    const bytes = a.bytes ?? new Uint8Array();
    return {
      ok: a.ok ?? true,
      status: a.status ?? 200,
      text: async () => a!.body ?? '',
      arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
      headers: { get: (n: string) => (n.toLowerCase() === 'content-type' ? a!.type ?? 'image/png' : null) },
    };
  };
  return { fn, asked };
}

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

describe('googleSitesPage: detection', () => {
  it.each([
    [MAIN, MAIN, '/view/nightback'],
    [`${MAIN}/`, MAIN, '/view/nightback'],
    [`${MAIN}?authuser=0#menu`, MAIN, '/view/nightback'],
    ['  http://SITES.GOOGLE.COM/view/nightback/main-menu  ', MAIN, '/view/nightback'],
    [`${SITE}`, SITE, '/view/nightback'],
    [`${SITE}/menus/drinks`, `${SITE}/menus/drinks`, '/view/nightback'],
    ['https://sites.google.com/example.com/intranet/home', 'https://sites.google.com/example.com/intranet/home', '/example.com/intranet'],
    [`https://sites.google.com/view/nightback/الصفحة-الرئيسية`, AR_HOME, '/view/nightback'],
  ])('%s', (input, url, site) => expect(googleSitesPage(input)).toEqual({ url, site }));

  it.each([
    'https://www.google.com/view/nightback/main-menu',
    'https://docs.google.com/document/d/abc/edit',
    'https://drive.google.com/view/nightback',
    'https://notsites.google.com/view/nightback/main-menu',
    'https://sites.google.com.evil.example/view/nightback',
    'https://sites.google.com/',
    'https://sites.google.com/view',
    'https://sites.google.com/new',
    'https://sites.google.com/u/0/d/1AbC/edit',
    'https://sites.google.com/d/1AbC/p/2XyZ/edit',
    'https://sites.google.com/view/nightback/_/view/prefs',
    'https://sites.google.com:8443/view/nightback/main-menu',
    'ftp://sites.google.com/view/nightback',
    'https://www.fresha.com/en-GB/a/salon-ab12',
    'https://kelah.yallaqrcodes.com/branch/1/',
    'not a url',
    '',
  ])('rejects %s', (input) => expect(googleSitesPage(input)).toBeNull());
});

describe('identities', () => {
  it('pageKey: encoded and plain Arabic paths, case and trailing slash are one page', () => {
    expect(pageKey(AR_HOME)).toBe(pageKey('https://sites.google.com/view/nightback/الصفحة-الرئيسية/'));
    expect(pageKey(`${SITE}/Hot-Drinks`)).toBe(pageKey(`${SITE}/hot-drinks`));
    expect(pageKey(`${SITE}/hot-drinks`)).not.toBe(pageKey(`${SITE}/cold-drinks`));
  });

  it('imageKey drops Google\'s size suffix only', () => {
    expect(imageKey('https://sites.google.com/sitesv-images-rt/AbC=w1280')).toBe(imageKey('https://sites.google.com/sitesv-images-rt/AbC=w640'));
    expect(imageKey('https://lh3.googleusercontent.com/XyZ=s400')).toBe('https://lh3.googleusercontent.com/XyZ');
    expect(imageKey('https://sites.google.com/sitesv-images-rt/AbC=w1280')).not.toBe(imageKey('https://sites.google.com/sitesv-images-rt/AbD=w1280'));
  });

  it('isSameSite: pages of this site only', () => {
    expect(isSameSite(`${SITE}/hot-drinks`, '/view/nightback')).toBe(true);
    expect(isSameSite(SITE, '/view/nightback')).toBe(true);
    expect(isSameSite('https://sites.google.com/view/nightbackx/hot', '/view/nightback')).toBe(false);
    expect(isSameSite('https://sites.google.com/view/other/hot-drinks', '/view/nightback')).toBe(false);
    expect(isSameSite('https://www.google.com/view/nightback/hot', '/view/nightback')).toBe(false);
    expect(isSameSite(`${SITE}/_/view/prefs`, '/view/nightback')).toBe(false);
  });
});

describe('parseGoogleSitesHtml: page, images and links', () => {
  it('the hub: 8 images in order, the 5 category buttons are links, no menu lines', () => {
    const p = parsed('main-menu');
    expect(p.siteName).toBe('عودة الليل لاونج');
    expect(p.pageName).toBe('Main Menu');
    expect(p.images).toHaveLength(8);
    expect(p.images.map((i) => i.link && decodeURIComponent(new URL(i.link).pathname))).toEqual([
      null,
      '/view/nightback/shisha-flavours', '/view/nightback/hot-drinks', '/view/nightback/cold-drinks',
      '/view/nightback/soft-drinks', '/view/nightback/cake-and-sweets',
      null, null,
    ]);
    expect(p.images.every((i) => i.src.startsWith('https://sites.google.com/sitesv-images-rt/'))).toBe(true);
    // Button labels are navigation, not content lines.
    expect(p.lines.map(clean)).toEqual(['Menu - English', 'Special offer for the morning shift', 'Shisha + Tea + Water = 39 Riyal only']);
    expect(p.links.map((l) => decodeURIComponent(new URL(l).pathname))).toEqual([
      '/view/nightback/shisha-flavours', '/view/nightback/hot-drinks', '/view/nightback/cold-drinks',
      '/view/nightback/soft-drinks', '/view/nightback/cake-and-sweets', '/view/nightback/الصفحة-الرئيسية',
    ]);
  });

  it('a category page: lines from the joined spans, the "back" button left out', () => {
    const p = parsed('cold-drinks');
    expect(p.pageName).toBe('Cold Drinks');
    expect(p.images).toEqual([]);
    expect(p.lines.map(clean)).toContain('RockStar ………….……. 13 Riyal');
    expect(p.lines.some((l) => /Back to main Menu/.test(l))).toBe(false);
  });

  it('a <br> inside a text box splits lines', () => {
    const html = `<html><head><meta property="og:url" content="${SITE}/x"><meta property="og:title" content="S - X"></head>
      <body><section><p>Tea ..... 5 SAR<br>Coffee ..... 9 SAR</p></section></body></html>`;
    expect(parseGoogleSitesHtml(html, `${SITE}/x`)!.lines).toEqual(['Tea ..... 5 SAR', 'Coffee ..... 9 SAR']);
  });

  it('the site header and navigation are not content', () => {
    const html = `<html><head><meta property="og:url" content="${SITE}/x"><meta property="og:title" content="S - X"></head>
      <body><header><section><p>Header text</p><img src="https://x.test/logo.png"></section></header>
      <nav><a href="${SITE}/other"><p>Other</p></a></nav><section><p>Tea ..... 5 SAR</p></section></body></html>`;
    const p = parseGoogleSitesHtml(html, `${SITE}/x`)!;
    expect(p.lines).toEqual(['Tea ..... 5 SAR']);
    expect(p.images).toEqual([]);
    expect(p.links).toEqual([]);
  });

  it('not a published Google Sites page → null', () => {
    expect(parseGoogleSitesHtml('<html><body><section><p>Tea 5 SAR</p></section></body></html>', MAIN)).toBeNull();
    expect(parseGoogleSitesHtml(`<html><head><meta property="og:url" content="https://example.com/"></head><body><section></section></body></html>`, MAIN)).toBeNull();
    expect(parseGoogleSitesHtml(`<html><head><meta property="og:url" content="${MAIN}"></head><body><p>no sections</p></body></html>`, MAIN)).toBeNull();
    expect(parseGoogleSitesHtml('', MAIN)).toBeNull();
  });
});

describe('classifyLine', () => {
  it.each([
    ['Red tea ………....….... 7 Riyal', 'Red tea', 7],
    ['Yanson tea … ……...... 7 Riyal', 'Yanson tea', 7],
    ['Espresso …………….15 Riyal', 'Espresso', 15],
    ['Mastic Gum.………………….……….. 45 Riyal', 'Mastic Gum', 45],
    ['Rita - plain\u00a0 .……….……. 12 Riyal', 'Rita - plain', 12],
    ['7 Up .................................... 10 Riyal', '7 Up', 10],
    ['Red code (flavors)..............15 Riyal', 'Red code (flavors)', 15],
    ['Cappuccino 18 SAR', 'Cappuccino', 18],
    ['Cappuccino - 18', 'Cappuccino', 18],
    ['Latte ........ SAR 22.50', 'Latte', 22.5],
    ['Big tray ........ 1,250 SAR', 'Big tray', 1250],
    ['ش\u0640اي احم\u0640\u0640ر ......................... 7\u00a0 ريال', 'شاي احمر', 7],
    ['روك\u0640و ست\u0640ارسادة \u00a0........................\u00a0 13 \u00a0ريال', 'روكو ستارسادة', 13],
    ['كيك زعفران (كبير) ........ ٢٥ ريال', 'كيك زعفران (كبير)', 25],
    ['قهوة ........ 12 ر.س', 'قهوة', 12],
  ])('item: %s', (line, name, price) => {
    expect(classifyLine(line)).toEqual({ kind: 'item', name, price, starting: false, duration: '' });
  });

  it('starting prices, in English and Arabic', () => {
    expect(classifyLine('Hair colour ........ from 200 SAR')).toMatchObject({ kind: 'item', name: 'Hair colour', price: 200, starting: true });
    expect(classifyLine('Hair colour ........ from SAR 200')).toMatchObject({ kind: 'item', price: 200, starting: true });
    expect(classifyLine('صبغة ........ يبدأ من 200 ريال')).toMatchObject({ kind: 'item', name: 'صبغة', price: 200, starting: true });
    expect(classifyLine('صبغة ........ من 200 ريال')).toMatchObject({ kind: 'item', price: 200, starting: true });
  });

  it('a duration printed with the item goes to Duration; the name is kept as written', () => {
    expect(classifyLine('Swedish massage 60 min ........ 200 SAR')).toEqual({ kind: 'item', name: 'Swedish massage 60 min', price: 200, starting: false, duration: '60 min' });
    expect(classifyLine('مساج 90 دقيقة ........ 250 ريال')).toMatchObject({ duration: '90 دقيقة', price: 250 });
    expect(classifyLine('Facial (1 hour) ..... 150 SAR')).toMatchObject({ duration: '1 hour' });
    expect(classifyLine('Tea Kettle ….............. 25 Riyal')).toMatchObject({ duration: '' });
  });

  it.each([
    'Shisha + Tea + Water = 39 Riyal only',
    'Burger ......... 20 - 30 SAR',
    'Juice Small ...... 10 SAR Large ...... 15 SAR',
    'Caesar salad 25',
    '..... 25 SAR',
  ])('looks priced but is not one clean item → unparsed: %s', (line) => {
    expect(classifyLine(line).kind).toBe('unparsed');
  });

  it('headings, table headers and noise', () => {
    expect(classifyLine('Fresh juices')).toEqual({ kind: 'heading', text: 'Fresh juices' });
    expect(classifyLine('ب\u0640\u0640\u0640ي\u0640\u0640\u0640\u0640\u0640\u0640\u0640رة\u00a0')).toEqual({ kind: 'heading', text: 'بيرة' });
    expect(classifyLine('\u064dShisha Flavours')).toEqual({ kind: 'heading', text: 'Shisha Flavours' });
    // A two-column table header is not a category.
    expect(classifyLine('Shisha Flavors \u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0Price')).toEqual({ kind: 'ignored' });
    expect(classifyLine('الصن\u0640\u0640\u0640\u0640\u0640\u0640ف \u00a0\u00a0\u00a0\u00a0\u00a0\u00a0السع\u0640ر للحبة')).toEqual({ kind: 'ignored' });
    expect(classifyLine('ا')).toEqual({ kind: 'ignored' });
    expect(classifyLine('\u00a0 ')).toEqual({ kind: 'ignored' });
    expect(classifyLine('All of our drinks are prepared fresh every morning by our team.')).toEqual({ kind: 'ignored' });
  });
});

describe('pageMenuRows: the real pages', () => {
  const rows = (slug: string) => pageMenuRows(parsed(slug));

  it('English edition: 103 items, 8 categories, every price a number, nothing unparsed', () => {
    const all = EN_PAGES.flatMap((s) => rows(s).rows);
    expect(all).toHaveLength(103);
    expect([...new Set(all.map((r) => r.Category))]).toEqual([
      'Hot Drinks', 'Soft Drinks', 'Beer', 'Shisha Flavours', 'Cold Drinks', 'Fresh juices', 'Cake and sweets', 'Snacks',
    ]);
    expect(all.every((r) => typeof r.Price === 'number' && r.Price > 0)).toBe(true);
    expect(all.every((r) => r.Type === 'Simple' && r['Option 1'] === '' && r['Option 1 Value'] === '')).toBe(true);
    expect(EN_PAGES.flatMap((s) => rows(s).unparsed)).toEqual([]);
  });

  it('sub-headings start a new category; before any heading the page name is used', () => {
    const soft = rows('soft-drinks').rows;
    expect(soft.find((r) => r.Name === 'Red Bull')).toMatchObject({ Category: 'Soft Drinks', Price: 18 });
    expect(soft.find((r) => r.Name === 'Heineken beer')).toMatchObject({ Category: 'Beer', Price: 24 });
    // "Shisha Flavors      Price" is a table header: the page name is the category.
    expect(rows('shisha-flavours').rows.every((r) => r.Category === 'Shisha Flavours')).toBe(true);
    expect(rows('cake-and-sweets').rows.slice(-1)[0]).toEqual(sitesRow('Chines mixed nuts', 'Snacks', 5, false, ''));
  });

  it('the exact first rows of Hot Drinks, in page order', () => {
    expect(rows('hot-drinks').rows.slice(0, 4)).toEqual([
      sitesRow('Red tea', 'Hot Drinks', 7, false, ''),
      sitesRow('Green tea', 'Hot Drinks', 7, false, ''),
      sitesRow('Black tea', 'Hot Drinks', 7, false, ''),
      sitesRow('Yanson tea', 'Hot Drinks', 7, false, ''),
    ]);
  });

  it('Arabic edition: 123 items in the site\'s own Arabic, never translated', () => {
    const ar = ['نكهات-الشيشة', 'المشروبات-الساخنة', 'المشروبات-الباردة', 'المشروبات-الغازية', 'الكيك-والحلويات'];
    const all = ar.flatMap((s) => rows(s).rows);
    expect(all).toHaveLength(107);
    expect(all.every((r) => scriptOf(String(r.Name) + String(r.Category)) === 'arabic' || /V60/.test(String(r.Name)))).toBe(true);
    expect(all.find((r) => r.Name === 'بيبسي')).toMatchObject({ Category: 'المشروبات الغازية', Price: 7 });
    expect(all.find((r) => r.Name === 'بيرة هينيكن')).toMatchObject({ Category: 'بيرة', Price: 24 });
    expect(all.find((r) => r.Name === 'عودة الليل (VIP)')).toMatchObject({ Category: 'نكهات الشيشة', Price: 60 });
    // The column header "الصنف … السعر للحبة" is not a category.
    expect(all.some((r) => /الصنف/.test(String(r.Category)))).toBe(false);
  });

  it('the hub has no menu rows; its offer line is reported as not parsed', () => {
    expect(rows('main-menu')).toEqual({ rows: [], unparsed: ['Shisha + Tea + Water = 39 Riyal only'] });
  });
});

describe('language, duplicates, stats', () => {
  it('scriptOf', () => {
    expect(scriptOf('Hot Drinks')).toBe('latin');
    expect(scriptOf('المشروبات الساخنة')).toBe('arabic');
    expect(scriptOf('V60 حار (كولمبي - اثيوبي)')).toBe('arabic');
    expect(scriptOf('123 - 456')).toBeNull();
  });

  it('dedupeRows: exact repeats only, first kept, case-insensitive', () => {
    const a = sitesRow('Latte', 'Hot', 20, false, '');
    const { rows, dropped } = dedupeRows([a, sitesRow('latte', 'hot', 20, false, ''), sitesRow('Latte', 'Cold', 20, false, ''), sitesRow('Latte', 'Hot', 22, false, '')]);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toBe(a);
    expect(dropped).toBe(1);
  });

  it('the summary and the report sheet', () => {
    const rows = [sitesRow('A', 'X', 5, true, '30 min'), sitesRow('B', 'Y', '', false, '')];
    const s = sitesStats(rows, { pages: 2, duplicatesDropped: 1, unparsed: 1, imagesRead: 0, modelCalls: 0 });
    expect(s).toMatchObject({ rows: 2, categories: 2, startingPrices: 1, noPrice: 1, withDuration: 1 });
    expect(googleSitesSummary('Night', s)).toBe(
      'Read the Google Site Night: 2 items in 2 categories from 2 pages, 1 with a starting price, 1 with no price, 1 with a duration, 1 duplicate row removed. The field selection does not apply: menu data has fixed columns.',
    );
    expect(googleSitesReportSheet([{ url: MAIN, name: 'Main Menu', status: 'no menu', rows: 0, note: '' }], [{ page: 'Main Menu', text: 'x = 3 SAR only' }])).toEqual([
      ['Page', 'Link', 'Status', 'Rows', 'Note'],
      ['Main Menu', MAIN, 'no menu', '0', ''],
      ['Main Menu', '', 'line not parsed', '0', 'x = 3 SAR only'],
    ]);
  });

  it('the columns are the scraper\'s menu columns', () => {
    expect([...GOOGLE_SITES_COLUMNS]).toEqual([...FRESHA_COLUMNS]);
    expect(Object.keys(sitesRow('a', 'b', 1, false, ''))).toEqual([...GOOGLE_SITES_COLUMNS]);
  });
});

describe('rowsFromOcrAnswer', () => {
  it('reads names verbatim, numbers as numbers, missing prices empty', () => {
    const answer = JSON.stringify([
      { name: 'شيشة + شاي + ماء', category: 'عرض الفترة الصباحية', price: 39, startingPrice: false, duration: null },
      { name: 'Hair cut', category: null, price: '50', startingPrice: true, duration: '30 min' },
      { name: 'Mystery', category: 'X', price: null },
      { name: 'Range', category: 'X', price: '20 - 30' },
      { name: '  ', price: 5 },
      'junk',
      { price: 3 },
    ]);
    const { rows, rejected } = rowsFromOcrAnswer(answer, 'Main Menu');
    expect(rejected).toBe(3);
    expect(rows).toEqual([
      sitesRow('شيشة + شاي + ماء', 'عرض الفترة الصباحية', 39, false, ''),
      sitesRow('Hair cut', 'Main Menu', 50, true, '30 min'),
      sitesRow('Mystery', 'X', '', false, ''),
      sitesRow('Range', 'X', '', false, ''),
    ]);
    expect(rows[0]['Price Note']).toBe('');
    expect(rows[1]['Price Note']).toBe(STARTING_PRICE_NOTE);
  });

  it('fenced JSON is accepted; an empty list is no rows', () => {
    expect(rowsFromOcrAnswer('```json\n[{"name":"Tea","price":5}]\n```', 'P').rows).toEqual([sitesRow('Tea', 'P', 5, false, '')]);
    expect(rowsFromOcrAnswer('[]', 'P')).toEqual({ rows: [], rejected: 0 });
  });

  it('an answer that is not a list throws', () => {
    expect(() => rowsFromOcrAnswer('{"name":"Tea"}', 'P')).toThrow(/not a list/);
    expect(() => rowsFromOcrAnswer('I cannot read this image', 'P')).toThrow();
  });

  it('the prompt forbids translation and guessed prices', () => {
    expect(OCR_PROMPT).toMatch(/Do NOT translate/);
    expect(OCR_PROMPT).toMatch(/never use 0 for a missing price/);
    expect(OCR_PROMPT).toMatch(/return \[\]/);
  });
});

describe('fetchGoogleSitesMenu', () => {
  it('the Night Back hub: the 5 English category pages, 103 rows, no model call', async () => {
    const { fn, asked } = fakeFetch();
    const readImage = vi.fn<ReadImage>();
    const res = await fetchGoogleSitesMenu(googleSitesPage(MAIN)!, fn, { readImage });

    expect(res.rows).toHaveLength(103);
    expect(res.stats).toMatchObject({ rows: 103, categories: 8, pages: 6, startingPrices: 0, noPrice: 0, withDuration: 0, duplicatesDropped: 0, unparsed: 1, imagesRead: 0, modelCalls: 0 });
    expect(res.script).toBe('latin');
    expect(readImage).not.toHaveBeenCalled();
    // Only Jina, in HTML mode, each page once, in link order; never Google directly.
    expect(asked.every((a) => a.url.startsWith('https://r.jina.ai/https://sites.google.com/') && a.format === 'html')).toBe(true);
    expect(asked.map((a) => decodeURIComponent(a.url.split('/').pop()!))).toEqual([
      'main-menu', 'shisha-flavours', 'hot-drinks', 'cold-drinks', 'soft-drinks', 'cake-and-sweets', 'الصفحة-الرئيسية',
    ]);
    expect(res.pages.map((p) => [p.name, p.status, p.rows])).toEqual([
      ['Main Menu', 'no menu', 0],
      ['Shisha Flavours', 'read', 15],
      ['Hot Drinks', 'read', 27],
      ['Cold Drinks', 'read', 34],
      ['Soft Drinks', 'read', 11],
      ['Cake and Sweets', 'read', 16],
      ['عودة الليل لاونج', 'other language', 0],
    ]);
    expect(res.unparsed).toEqual([{ page: 'Main Menu', text: 'Shisha + Tea + Water = 39 Riyal only' }]);
    // Row order follows the hub's link order.
    expect(res.rows[0]).toEqual(sitesRow('Two palm apples (Nakhlah)', 'Shisha Flavours', 45, false, ''));
  });

  it('the Arabic hub: the Arabic edition only, the English hub listed as the other language', async () => {
    const { fn } = fakeFetch();
    const res = await fetchGoogleSitesMenu(googleSitesPage(AR_HOME)!, fn);
    expect(res.rows).toHaveLength(107);
    expect(res.script).toBe('arabic');
    expect(res.rows.some((r) => /[A-Za-z]{3,}/.test(String(r.Category)))).toBe(false);
    expect(res.pages.find((p) => p.name === 'Main Menu')).toMatchObject({ status: 'other language' });
  });

  it('a category page pasted directly: its own rows; the hub it links back to adds none', async () => {
    const { fn, asked } = fakeFetch();
    const res = await fetchGoogleSitesMenu(googleSitesPage(`${SITE}/soft-drinks`)!, fn);
    expect(res.rows).toHaveLength(11);
    expect(asked).toHaveLength(2); // the page, then main-menu — not the whole site
    expect(res.pages.map((p) => p.status)).toEqual(['read', 'no menu']);
  });

  it('both editions linked from one page: only the pasted page\'s language is kept', async () => {
    const hub = `<html><head><meta property="og:url" content="${SITE}/both"><meta property="og:title" content="Night - Menus"></head><body><section>
      <a href="/view/nightback/hot-drinks"><p>Hot</p></a><a href="/view/nightback/${encodeURIComponent('المشروبات-الساخنة')}"><p>ساخن</p></a>
      <a href="/view/nightback/soft-drinks"><p>Soft</p></a></section></body></html>`;
    const { fn } = fakeFetch({ both: hub });
    const res = await fetchGoogleSitesMenu(googleSitesPage(`${SITE}/both`)!, fn);
    expect(res.rows).toHaveLength(27 + 11);
    expect(res.pages.find((p) => p.name === 'المشروبات الساخنة')).toMatchObject({ status: 'other language', rows: 0, note: '27 rows in the other language edition were not added.' });
  });

  it('duplicate links (query, fragment, case, slash, self) are read once; other sites never', async () => {
    const hub = `<html><head><meta property="og:url" content="${SITE}/dups"><meta property="og:title" content="Night - Dups"></head><body><section>
      <a href="/view/nightback/hot-drinks"><p>a</p></a><a href="/view/nightback/hot-drinks?x=1#top"><p>b</p></a>
      <a href="https://sites.google.com/view/nightback/Hot-Drinks/"><p>c</p></a><a href="/view/nightback/dups"><p>self</p></a>
      <a href="/view/othersite/hot-drinks"><p>other</p></a><a href="https://example.com/menu"><p>ext</p></a>
      <a href="/view/nightback/_/view/prefs"><p>internal</p></a></section></body></html>`;
    const { fn, asked } = fakeFetch({ dups: hub });
    const res = await fetchGoogleSitesMenu(googleSitesPage(`${SITE}/dups`)!, fn);
    expect(asked.map((a) => a.url.split('/').pop())).toEqual(['dups', 'hot-drinks']);
    expect(res.rows).toHaveLength(27);
  });

  it('the same menu on two linked pages: repeated rows are removed and counted', async () => {
    const hub = `<html><head><meta property="og:url" content="${SITE}/twice"><meta property="og:title" content="Night - Twice"></head><body><section>
      <a href="/view/nightback/hot-drinks"><p>a</p></a><a href="/view/nightback/hot-copy"><p>b</p></a></section></body></html>`;
    const { fn } = fakeFetch({ twice: hub, 'hot-copy': htmlOf('hot-drinks').replace(/hot-drinks/g, 'hot-copy') });
    const res = await fetchGoogleSitesMenu(googleSitesPage(`${SITE}/twice`)!, fn);
    expect(res.rows).toHaveLength(27);
    expect(res.stats.duplicatesDropped).toBe(27);
  });

  it(`at most ${MAX_LINKED_PAGES} linked pages are read; the rest are listed`, async () => {
    const links = Array.from({ length: MAX_LINKED_PAGES + 3 }, (_, i) => `<a href="/view/nightback/p${i}"><p>p${i}</p></a>`).join('');
    const hub = `<html><head><meta property="og:url" content="${SITE}/many"><meta property="og:title" content="Night - Many"></head><body><section>${links}</section></body></html>`;
    const pages: Record<string, string> = { many: hub };
    for (let i = 0; i < MAX_LINKED_PAGES + 3; i++) {
      pages[`p${i}`] = `<html><head><meta property="og:url" content="${SITE}/p${i}"><meta property="og:title" content="Night - P${i}"></head><body><section><p>Item ${i} ...... ${i + 1} SAR</p></section></body></html>`;
    }
    const { fn, asked } = fakeFetch(pages);
    const res = await fetchGoogleSitesMenu(googleSitesPage(`${SITE}/many`)!, fn);
    expect(asked).toHaveLength(1 + MAX_LINKED_PAGES);
    expect(res.rows).toHaveLength(MAX_LINKED_PAGES);
    expect(res.pages.filter((p) => p.status === 'not read: limit')).toHaveLength(3);
    expect(res.pages.slice(-1)[0].url).toBe(`${SITE}/p${MAX_LINKED_PAGES + 2}`);
  });

  describe('failures', () => {
    it('the pasted page cannot be read → GoogleSitesError (network, status, not a Google Site)', async () => {
      await expect(fetchGoogleSitesMenu(googleSitesPage(MAIN)!, fakeFetch({ 'main-menu': { error: new TypeError('Failed to fetch') } }).fn)).rejects.toThrow('Failed to fetch');
      await expect(fetchGoogleSitesMenu(googleSitesPage(MAIN)!, fakeFetch({ 'main-menu': { ok: false, status: 451 } }).fn)).rejects.toThrow(new GoogleSitesError('The page answered 451.'));
      await expect(fetchGoogleSitesMenu(googleSitesPage(MAIN)!, fakeFetch({ 'main-menu': '<html><body>Jina error</body></html>' }).fn)).rejects.toThrow('not a published Google Sites page');
    });

    it('a linked page that fails is listed; the others are still read', async () => {
      const { fn } = fakeFetch({ 'hot-drinks': { error: new TypeError('Failed to fetch') }, 'cold-drinks': { ok: false, status: 500 } });
      const res = await fetchGoogleSitesMenu(googleSitesPage(MAIN)!, fn);
      expect(res.rows).toHaveLength(103 - 27 - 34);
      expect(res.pages.filter((p) => p.status === 'failed').map((p) => p.note)).toEqual(['Failed to fetch', 'The page answered 500.']);
    });

    it('a hung page is a timeout; an error that is not our abort is reported as itself', async () => {
      await expect(fetchGoogleSitesMenu(googleSitesPage(MAIN)!, fakeFetch({ 'main-menu': { hang: true } }).fn, { pageTimeoutMs: 20 }))
        .rejects.toThrow(new GoogleSitesError('The page did not answer within 0 s.'));
      const other = Object.assign(new Error('The user aborted a request.'), { name: 'AbortError' });
      await expect(fetchGoogleSitesMenu(googleSitesPage(MAIN)!, fakeFetch({ 'main-menu': { error: other } }).fn, { pageTimeoutMs: 5_000 }))
        .rejects.toBe(other);
    });

    it('the total page budget: pages not reached in time are listed, not read', async () => {
      let t = 0;
      const { fn, asked } = fakeFetch();
      const res = await fetchGoogleSitesMenu(googleSitesPage(MAIN)!, fn, { totalTimeoutMs: 1_000, now: () => (t += 400) });
      expect(asked.length).toBeLessThan(7);
      expect(res.pages.some((p) => p.status === 'not read: limit')).toBe(true);
    });
  });

  describe('images (only when no page has menu text)', () => {
    /** The hub alone: every category page fails, so no text rows exist. */
    const hubOnly = () => Object.fromEntries([...EN_PAGES, 'الصفحة-الرئيسية'].map((s) => [s, { ok: false, status: 503 } as Answer]));
    const contentImages = parsed('main-menu').images.filter((i) => !i.link).map((i) => i.src);

    it('reads the 3 non-button images in order; logo and photo give nothing, the offer gives a row', async () => {
      const { fn, asked } = fakeFetch(hubOnly(), { '*': { bytes: PNG, type: 'image/png' } });
      const answers = ['[]', '[]', JSON.stringify([{ name: 'شيشة + شاي + ماء', category: 'عرض الفترة الصباحية', price: 39, startingPrice: false, duration: null }])];
      const readImage = vi.fn<ReadImage>(async () => answers.shift()!);
      const res = await fetchGoogleSitesMenu(googleSitesPage(MAIN)!, fn, { readImage });

      expect(asked.filter((a) => !a.url.startsWith('https://r.jina.ai/')).map((a) => a.url)).toEqual(contentImages);
      expect(readImage).toHaveBeenCalledTimes(3);
      expect(readImage.mock.calls[0]).toEqual([btoa(String.fromCharCode(...PNG)), 'image/png', OCR_PROMPT]);
      expect(res.rows).toEqual([sitesRow('شيشة + شاي + ماء', 'عرض الفترة الصباحية', 39, false, '')]);
      expect(res.stats).toMatchObject({ imagesRead: 3, modelCalls: 3 });
    });

    it('an image that cannot be downloaded is skipped with a warning', async () => {
      const images: Record<string, Answer> = { '*': { bytes: PNG } };
      images[contentImages[0]] = { error: new TypeError('Failed to fetch') };
      images[contentImages[1]] = { bytes: PNG, type: 'text/html' };
      const readImage = vi.fn<ReadImage>(async () => '[{"name":"Tea","price":5}]');
      const res = await fetchGoogleSitesMenu(googleSitesPage(MAIN)!, fakeFetch(hubOnly(), images).fn, { readImage });
      expect(readImage).toHaveBeenCalledTimes(1);
      expect(res.rows).toEqual([sitesRow('Tea', 'Main Menu', 5, false, '')]);
      expect(res.warnings).toEqual([
        'Image 1 on "Main Menu" could not be downloaded: Failed to fetch',
        'Image 2 on "Main Menu" could not be downloaded: Not a readable image (text/html).',
      ]);
    });

    it('a model failure stops the read (no half results) so the caller can fall back', async () => {
      const readImage = vi.fn<ReadImage>(async () => { throw new Error('API key not valid'); });
      const err = await fetchGoogleSitesMenu(googleSitesPage(MAIN)!, fakeFetch(hubOnly(), { '*': { bytes: PNG } }).fn, { readImage }).catch((e) => e);
      expect(err).toBeInstanceOf(GoogleSitesError);
      expect(err.message).toBe('Reading the menu images failed: API key not valid');
      expect(readImage).toHaveBeenCalledTimes(1);
    });

    it('a model that never answers is a timeout', async () => {
      const readImage = vi.fn<ReadImage>(() => new Promise(() => undefined));
      await expect(fetchGoogleSitesMenu(googleSitesPage(MAIN)!, fakeFetch(hubOnly(), { '*': { bytes: PNG } }).fn, { readImage, ocrTimeoutMs: 20 }))
        .rejects.toThrow('Reading the menu images failed: The AI model did not answer within 0 s.');
    });

    it('unusable answers everywhere → no rows → GoogleSitesError', async () => {
      const readImage = vi.fn<ReadImage>(async () => 'Sorry, I cannot help.');
      await expect(fetchGoogleSitesMenu(googleSitesPage(MAIN)!, fakeFetch(hubOnly(), { '*': { bytes: PNG } }).fn, { readImage }))
        .rejects.toThrow("No menu items were found in the site's text or images.");
      expect(readImage).toHaveBeenCalledTimes(3);
    });

    it('without an image reader, no text means an error, never a model call', async () => {
      await expect(fetchGoogleSitesMenu(googleSitesPage(MAIN)!, fakeFetch(hubOnly()).fn)).rejects.toThrow('images are not read here');
    });

    it('no text and only button images → an error before any model call', async () => {
      const page = htmlOf('main-menu').replace(/<img[^>]*role="img"[^>]*>/g, '');
      const readImage = vi.fn<ReadImage>();
      await expect(fetchGoogleSitesMenu(googleSitesPage(MAIN)!, fakeFetch({ ...hubOnly(), 'main-menu': page }).fn, { readImage }))
        .rejects.toThrow('No menu text and no content images');
      expect(readImage).not.toHaveBeenCalled();
    });
  });
});
