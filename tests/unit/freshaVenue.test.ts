import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  freshaVenueUrl, parseFreshaVenueHtml, freshaRows, FRESHA_COLUMNS, STARTING_PRICE_NOTE, BOOKING_ONLY_NOTE,
  type FreshaVenue,
} from '../../utils/freshaVenue';
import { fetchFreshaVenue, FreshaVenueError } from '../../services/freshaVenueService';

/**
 * Fresha venue menus for Web Scraper, against the real capture of Little Palm
 * Spa's public venue page (tests/fixtures/fresha/, 2026-10-01).
 */
const fx = (n: string) => readFileSync(new URL(`../fixtures/fresha/${n}`, import.meta.url), 'utf-8');
const VENUE_HTML = fx('little-palm-spa-venue.html');
const BOOKING_ONLY = JSON.parse(fx('booking-only-addons.example.json')).services as { name: string; price: string }[];
const BOOKING = 'https://www.fresha.com/en-GB/a/little-palm-spa-lytl-blm-sb-llkhdm-lmnzly-eastern-province-home-service-khdm-mnzly-f4pn5kmx/booking?pId=1000001&cartId=00000000-0000-4000-8000-000000000000';
const VENUE = 'https://www.fresha.com/en-GB/a/little-palm-spa-lytl-blm-sb-llkhdm-lmnzly-eastern-province-home-service-khdm-mnzly-f4pn5kmx';

describe('freshaVenueUrl', () => {
  it('a booking link becomes the public venue page, without /booking or the cart query', () => {
    expect(freshaVenueUrl(BOOKING)).toBe(VENUE);
  });

  it.each([
    [VENUE, VENUE],
    [VENUE + '/', VENUE],
    [VENUE + '?share=1#services', VENUE],
    // Always the en-GB page: Fresha's own labels ("from", durations) then come
    // in one language. The Arabic page writes `من ‏575 ر.س.` and `3 س`.
    ['https://fresha.com/a/some-salon-x1y2', 'https://www.fresha.com/en-GB/a/some-salon-x1y2'],
    ['http://www.fresha.com/ar/a/salon-ab12/booking', 'https://www.fresha.com/en-GB/a/salon-ab12'],
    ['https://www.fresha.com/ar-SA/a/salon-ab12', 'https://www.fresha.com/en-GB/a/salon-ab12'],
    ['  https://www.FRESHA.com/en-GB/a/salon-ab12/booking/services  ', 'https://www.fresha.com/en-GB/a/salon-ab12'],
  ])('%s → %s', (input, out) => expect(freshaVenueUrl(input)).toBe(out));

  it.each([
    'https://kelah.yallaqrcodes.com/branch/1/',
    'https://www.fresha.com/en-GB/lp/en/bt/massage/in/sa-riyadh',
    'https://www.fresha.com/',
    'https://notfresha.com/a/salon-ab12',
    'https://www.fresha.com.evil.example/a/salon-ab12',
    'ftp://www.fresha.com/a/salon-ab12',
    'not a url',
    '',
  ])('%j is not a Fresha venue link', (input) => expect(freshaVenueUrl(input)).toBeNull());
});

describe('parseFreshaVenueHtml', () => {
  it('reads the embedded venue data: 9 categories, 67 services', () => {
    const venue = parseFreshaVenueHtml(VENUE_HTML)!;
    expect(venue.name).toBe('Little Palm Spa ليتل بالم سبا للخدمة المنزلية');
    expect(venue.categories).toHaveLength(9);
    expect(venue.categories.reduce((n, c) => n + c.items.length, 0)).toBe(67);
  });

  it.each([
    ['no embedded data', '<html><body><h1>Select services</h1></body></html>'],
    ['broken JSON', '<script id="__NEXT_DATA__" type="application/json">{"props": </script>'],
    ['another page shape', '<script id="__NEXT_DATA__" type="application/json">{"props":{"pageProps":{"data":{}}}}</script>'],
    ['services not a list', '<script id="__NEXT_DATA__" type="application/json">{"props":{"pageProps":{"data":{"location":{"services":{}}}}}}</script>'],
    ['no services at all', '<script id="__NEXT_DATA__" type="application/json">{"props":{"pageProps":{"data":{"location":{"services":[{"name":"x","items":[]}]}}}}}</script>'],
    ['empty input', ''],
  ])('%s → null (the caller falls back)', (_label, html) => {
    expect(parseFreshaVenueHtml(html)).toBeNull();
  });
});

describe('freshaRows on the real venue data', () => {
  const { rows, stats } = freshaRows(parseFreshaVenueHtml(VENUE_HTML)!);
  const byName = (n: string) => rows.find((r) => r.Name === n)!;

  it('one row per service, in the scraper columns plus Duration and Price Note', () => {
    expect(rows).toHaveLength(67);
    expect(rows.every((r) => JSON.stringify(Object.keys(r)) === JSON.stringify([...FRESHA_COLUMNS]))).toBe(true);
    expect(stats).toEqual({ categories: 9, services: 67, rows: 67, startingPrices: 10, withOptions: 0, noPrice: 0 });
  });

  it('categories, in the venue order, with their service counts', () => {
    const counts = new Map<string, number>();
    for (const r of rows) counts.set(r.Category, (counts.get(r.Category) ?? 0) + 1);
    expect([...counts]).toEqual([
      ['معالجات الشعر | Hair treatment', 6],
      ['خدمات العناية باليدين والقدمين | manicure & badicure Services', 12],
      ['خدمات تنظيف البشره | Facial services', 2],
      ['Bath Services | خدمات الحمام', 4],
      ['خدمات الشعر | Hair services', 10],
      ['خدمات المساج | Massage services', 12],
      ['خدمات العناية بالجسم | Body Care Services', 11],
      ['خدمة العناية بالوجه | Facial Care Service', 8],
      ['باقات | backages', 2],
    ]);
  });

  it('names as the venue writes them (spacing tidied), numeric prices, durations', () => {
    expect(byName('بوتكس الشعر | Botox treatment')).toEqual({
      Name: 'بوتكس الشعر | Botox treatment', Category: 'معالجات الشعر | Hair treatment', Price: '575.00', Type: 'Simple',
      'Option 1': '', 'Option 1 Value': '', Duration: '3 hours', 'Price Note': STARTING_PRICE_NOTE,
    });
    expect(byName('حمام مغربي ملكي | Royal Moroccan Bath')).toMatchObject({ Price: '380.00', Duration: '2 hours', 'Price Note': '' });
    expect(byName('برافين لليدين | Hand Paraffin')).toMatchObject({ Price: '55.00', Duration: '35 mins' });
    expect(byName('باقه مود | Mood package')).toMatchObject({ Price: '395.00', Duration: '2 hours 45 mins • 2 services' });
    expect(rows.every((r) => /^\d+\.\d{2}$/.test(r.Price))).toBe(true);
    expect(rows.every((r) => r.Duration !== '')).toBe(true);
  });

  it('exactly the 10 "from" prices carry Price Note = Starting price, at the starting price', () => {
    const starting = rows.filter((r) => r['Price Note'] === STARTING_PRICE_NOTE);
    expect(starting.map((r) => [r.Name, r.Price])).toEqual([
      ['بوتكس الشعر | Botox treatment', '575.00'],
      ['الكولاجين | Collgen', '575.00'],
      ['بيبي سيلك | baby silk', '400.00'],
      ['فيلر ملكي معالج بارد | Royal filler', '250.00'],
      ['تغذية الشعر بالكولاجين معالج بارد | Collagen Hair Treatment', '250.00'],
      ['تغذية الشعر بالبوتكس معالج بارد | Botox cold Hair Treatment', '250.00'],
      ['حمام الزيت | Hot oil treatment', '75.00'],
      ['سيراميك للشعر | Hair Ironing', '120.00'],
      ['استشوار ويفي | Wavy hair', '120.00'],
      ['استشوار الشعر | Hair blow dry', '70.00'],
    ]);
    expect(rows.filter((r) => r['Price Note'] !== STARTING_PRICE_NOTE).every((r) => r['Price Note'] === '')).toBe(true);
  });

  it('a single variant is ONE row: no invented options', () => {
    expect(rows.every((r) => r.Type === 'Simple' && r['Option 1'] === '' && r['Option 1 Value'] === '')).toBe(true);
  });

  it('the booking-only add-ons are NOT in the rows (they cannot be read; nothing is copied in)', () => {
    for (const s of BOOKING_ONLY) expect(rows.some((r) => r.Name === s.name.replace(/\s+/g, ' ').trim())).toBe(false);
  });
});

describe('freshaRows rules on synthetic data', () => {
  const venue = (items: unknown[]): FreshaVenue => ({ name: 'V', categories: [{ name: 'Cat', items: items as never }] });

  it('two or more distinct named variants become option rows, each at its own price', () => {
    const { rows, stats } = freshaRows(venue([{
      name: 'Haircut', caption: '30 mins', formattedRetailPrice: 'from SAR 50', retailPrice: { value: 50 },
      variants: [
        { name: 'Short hair', caption: '30 mins', formattedRetailPrice: 'SAR 50' },
        { name: 'Long hair', caption: '45 mins', formattedRetailPrice: 'SAR 1,250.50' },
      ],
    }]));
    expect(rows.map((r) => [r.Type, r['Option 1'], r['Option 1 Value'], r.Price, r.Duration, r['Price Note']])).toEqual([
      ['Variable', 'Option', 'Short hair', '50.00', '30 mins', ''],
      ['Variable', 'Option', 'Long hair', '1250.50', '45 mins', ''],
    ]);
    expect(stats.withOptions).toBe(1);
  });

  it('a repeated variant name is one option, not two rows', () => {
    const { rows } = freshaRows(venue([{
      name: 'Cut', formattedRetailPrice: 'SAR 9', retailPrice: { value: 9 },
      variants: [{ name: 'Short', formattedRetailPrice: 'SAR 9' }, { name: 'Short', formattedRetailPrice: 'SAR 9' }, { name: 'Long', formattedRetailPrice: 'SAR 12' }],
    }]));
    expect(rows.map((r) => [r['Option 1 Value'], r.Price])).toEqual([['Short', '9.00'], ['Long', '12.00']]);
  });

  it('variants with the same name are not options: one row', () => {
    const { rows } = freshaRows(venue([{ name: 'X', formattedRetailPrice: 'SAR 9', retailPrice: { value: 9 }, variants: [{ name: 'X' }, { name: 'X' }] }]));
    expect(rows.map((r) => r.Type)).toEqual(['Simple']);
  });

  it('a missing price stays empty — never 0.00 — and is counted', () => {
    const { rows, stats } = freshaRows(venue([{ name: 'Ask us', caption: '1 hour', retailPrice: null, formattedRetailPrice: 'Price on request' }]));
    expect(rows[0].Price).toBe('');
    expect(stats.noPrice).toBe(1);
  });
});

describe('the "Not on venue page" note', () => {
  it('explains booking-only add-ons and lists no service, price or name', () => {
    const all = BOOKING_ONLY_NOTE.join(' ');
    expect(all).toMatch(/booking flow/);
    expect(all).toMatch(/cannot read/);
    expect(all).not.toMatch(/SAR|\d/);
    for (const s of BOOKING_ONLY) expect(all).not.toContain(s.name.split(' | ')[1].trim());
  });
});

describe('fetchFreshaVenue', () => {
  const ok = (body: string) => async () => ({ ok: true, status: 200, text: async () => body });

  it('one Jina request in HTML mode for the venue page, never the booking flow', async () => {
    const calls: { url: string; headers?: Record<string, string> }[] = [];
    const r = await fetchFreshaVenue(VENUE, async (url, init) => { calls.push({ url, headers: init?.headers }); return ok(VENUE_HTML)(); });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(`https://r.jina.ai/${VENUE}`);
    expect(calls[0].headers).toMatchObject({ 'X-Return-Format': 'html', 'X-No-Cache': 'true' });
    expect(calls[0].url).not.toMatch(/booking|graphql|cartId/);
    expect(r.rows).toHaveLength(67);
    expect(r.venue).toContain('Little Palm Spa');
  });

  it('throws — so the scraper falls back — on an error status, a page without the data, or a timeout', async () => {
    await expect(fetchFreshaVenue(VENUE, async () => ({ ok: false, status: 451, text: async () => '' }))).rejects.toBeInstanceOf(FreshaVenueError);
    await expect(fetchFreshaVenue(VENUE, ok('<html>Select services</html>'))).rejects.toThrow(/menu data/);
    const hang = (_u: string, init?: { signal?: AbortSignal }) => new Promise<never>((_, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
    });
    await expect(fetchFreshaVenue(VENUE, hang, 50)).rejects.toThrow(/did not answer within/);
  });
});
