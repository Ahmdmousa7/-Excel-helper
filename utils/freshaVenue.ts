/**
 * Fresha venue menus for Web Scraper: link detection, and Fresha's own venue
 * data turned straight into rows. Pure — no network, no DOM — so it is tested
 * against a real capture (`tests/fixtures/fresha/`); the I/O lives in
 * `services/freshaVenueService.ts`.
 *
 * WHY NOT THE PAGE TEXT. A Fresha booking link (`…/a/<venue>/booking?…`) is a
 * client-rendered flow: read as text it shows only the FIRST category (6 of
 * 70 services on Little Palm Spa, 2026-10-01). Its data comes from Fresha's
 * booking API, which only answers fresha.com itself (CORS) and is not used.
 *
 * WHAT IS USED. The PUBLIC venue page (`…/a/<venue>`, the same link without
 * `/booking` and the query) is server-rendered with the whole menu embedded as
 * `__NEXT_DATA__` → `props.pageProps.data.location.services`: categories, each
 * with items carrying `name`, `caption` (the duration), `retailPrice`
 * (`{ currency, value }`), `formattedRetailPrice` and `variants`. Read through
 * Jina in HTML mode, which the browser is allowed to call.
 *
 * WHAT IT CANNOT SEE. Services offered only inside the booking flow (add-ons,
 * typically) are absent from the venue page. They are never guessed: the
 * export carries a `Not on venue page` note instead (BOOKING_ONLY_NOTE).
 */

export type FreshaRow = Record<string, string>;

/** The scraper's usual columns, then the two this source adds. */
export const FRESHA_COLUMNS = ['Name', 'Category', 'Price', 'Type', 'Option 1', 'Option 1 Value', 'Duration', 'Price Note'] as const;

export const STARTING_PRICE_NOTE = 'Starting price';

/** The `Not on venue page` sheet: a note, never services. */
export const BOOKING_ONLY_NOTE: readonly string[] = [
  "Fresha's booking flow can offer add-on services that are not listed on the venue's public page.",
  'This app cannot read those booking-only services, so they are not in Scraped Data.',
  'No services are listed here on purpose: nothing has been guessed or copied from elsewhere.',
  "Check the venue's booking page on Fresha for any add-ons, and add them by hand if needed.",
];

const FRESHA_HOST = /^(?:www\.)?fresha\.com$/i;

/**
 * `/<locale>/a/<venue>` or `/a/<venue>`. The locale is one path segment in
 * BCP-47 form, any letter case: a 2-3 letter language, then an optional
 * 4-letter script, then an optional 2-letter or 3-digit region (`ar`, `en-GB`,
 * `EN-gb`, `zh-HK`, `zh-Hant-HK`, `es-419`). Fresha's venue page links itself
 * in 37 such locales (2026-10-01), all of the language or language-region form.
 * Nothing looser: `/a/` must follow at once and stays lowercase, as Fresha
 * writes it, and the venue id is the next segment.
 */
const FRESHA_VENUE_PATH = /^\/(?:[A-Za-z]{2,3}(?:-[A-Za-z]{4})?(?:-(?:[A-Za-z]{2}|\d{3}))?\/)?a\/([A-Za-z0-9-]+)(?:\/|$)/;

/**
 * The public venue page for a Fresha booking or venue link, or null when the
 * link is not one. Drops `/booking`, anything after it, and the query (cart and
 * session ids).
 *
 * ALWAYS the `en-GB` page, whatever language the link uses. Fresha writes its
 * own labels in the page's language — the Arabic page gives a starting price
 * as `من ‏575 ر.س.` and a duration as `3 س` (measured 2026-10-01), where the
 * English page gives `from SAR 575` and `3 hours` — so a fixed language keeps
 * starting-price detection and durations right. The venue's own text (service
 * and category names) is identical in every language: same 67 services, same
 * names, verified on the Arabic and English pages of the test venue.
 *
 *   https://www.fresha.com/ar/a/<slug>/booking?pId=1&cartId=…
 *   → https://www.fresha.com/en-GB/a/<slug>
 */
export function freshaVenueUrl(link: string): string | null {
  let u: URL;
  try {
    u = new URL(link.trim());
  } catch {
    return null;
  }
  if (!/^https?:$/.test(u.protocol) || !FRESHA_HOST.test(u.hostname)) return null;
  const m = FRESHA_VENUE_PATH.exec(u.pathname);
  if (!m) return null;
  return `https://www.fresha.com/en-GB/a/${m[1]}`;
}

interface FreshaPrice { currency?: unknown; value?: unknown }
interface FreshaVariant { name?: unknown; caption?: unknown; formattedRetailPrice?: unknown; retailPrice?: FreshaPrice | null }
interface FreshaItem { name?: unknown; caption?: unknown; retailPrice?: FreshaPrice | null; formattedRetailPrice?: unknown; variants?: unknown }
interface FreshaCategory { name?: unknown; items?: unknown }

export interface FreshaVenue {
  name: string;
  categories: { name: string; items: FreshaItem[] }[];
}

const text = (v: unknown): string => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '');
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/**
 * The venue data embedded in a Fresha venue page's HTML, or null when it is
 * missing or not the expected shape — the caller then falls back to the
 * page-text scrape. Never throws.
 */
export function parseFreshaVenueHtml(html: string): FreshaVenue | null {
  const m = /<script[^>]*\bid=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i.exec(html);
  if (!m) return null;
  let data: unknown;
  try {
    data = JSON.parse(m[1]);
  } catch {
    return null;
  }
  const location = (data as { props?: { pageProps?: { data?: { location?: unknown } } } })?.props?.pageProps?.data?.location;
  if (!isObj(location) || !Array.isArray(location.services)) return null;
  const categories = (location.services as unknown[])
    .filter(isObj)
    .map((c: FreshaCategory) => ({ name: text(c.name), items: Array.isArray(c.items) ? (c.items as unknown[]).filter(isObj) as FreshaItem[] : [] }));
  const services = categories.reduce((n, c) => n + c.items.length, 0);
  if (services === 0) return null; // the shape is there but empty: treat as not found
  return { name: text(location.name), categories };
}

/** `575` → `575.00`; anything else → '' (a missing price is left empty, never 0). */
const priceText = (p: FreshaPrice | null | undefined): string =>
  p && typeof p.value === 'number' && Number.isFinite(p.value) ? p.value.toFixed(2) : '';

/** Fresha writes a starting price as `from SAR 575`. */
const isStartingPrice = (formatted: unknown): boolean => /^\s*from\b/i.test(text(formatted));

/** The number in `SAR 175` / `from SAR 1,250.50`, for variants that carry no `retailPrice`. */
const priceFromFormatted = (formatted: unknown): string => {
  const m = /(\d[\d,]*(?:\.\d+)?)/.exec(text(formatted));
  if (!m) return '';
  const n = Number(m[1].replace(/,/g, ''));
  return Number.isFinite(n) ? n.toFixed(2) : '';
};

export interface FreshaStats { categories: number; services: number; rows: number; startingPrices: number; withOptions: number; noPrice: number }

/**
 * One row per service, in the venue's own order. A service only becomes
 * option rows when Fresha lists two or more distinct, named variants for it —
 * real choices the source exposes. One variant (the usual case, including
 * every "from" price on the test venue) is one row: nothing is invented.
 *
 * That one row takes the SERVICE's price and duration, on purpose: Fresha's
 * service fields summarise its variants, and for a single variant they are the
 * same values — on the test venue all 66 single-variant services have the
 * variant's name, caption and formatted price identical to the service's, in
 * the English and the Arabic page alike (checked 2026-10-01). And only the
 * service carries the price as a NUMBER (`retailPrice.value`); a variant has
 * just the localised display text. Option rows use each variant's own values,
 * because there each variant is a separate choice with its own price.
 */
export function freshaRows(venue: FreshaVenue): { rows: FreshaRow[]; stats: FreshaStats } {
  const rows: FreshaRow[] = [];
  const stats: FreshaStats = { categories: 0, services: 0, rows: 0, startingPrices: 0, withOptions: 0, noPrice: 0 };
  for (const cat of venue.categories) {
    if (cat.items.length) stats.categories++;
    for (const item of cat.items) {
      stats.services++;
      const name = text(item.name);
      const variants = (Array.isArray(item.variants) ? item.variants : []).filter(isObj) as FreshaVariant[];
      // One variant per name: a repeated name is not a second option.
      const seen = new Set<string>();
      const named = variants.filter((v) => {
        const n = text(v.name);
        if (!n || seen.has(n)) return false;
        seen.add(n);
        return true;
      });
      if (named.length >= 2) {
        stats.withOptions++;
        // Counted per SERVICE (this `item`), not per option row: one service
        // with three "from" options is one service with a starting price, and
        // one service whose options have no price is one service without one.
        let serviceHasStartingPrice = false;
        let serviceMissingPrice = false;
        for (const v of named) {
          const starting = isStartingPrice(v.formattedRetailPrice);
          const price = priceText(v.retailPrice) || priceFromFormatted(v.formattedRetailPrice);
          if (starting) serviceHasStartingPrice = true;
          if (!price) serviceMissingPrice = true;
          rows.push({
            Name: name, Category: cat.name, Price: price, Type: 'Variable',
            'Option 1': 'Option', 'Option 1 Value': text(v.name),
            Duration: text(v.caption) || text(item.caption), 'Price Note': starting ? STARTING_PRICE_NOTE : '',
          });
        }
        if (serviceHasStartingPrice) stats.startingPrices++;
        if (serviceMissingPrice) stats.noPrice++;
        continue;
      }
      const starting = isStartingPrice(item.formattedRetailPrice);
      const price = priceText(item.retailPrice) || priceFromFormatted(item.formattedRetailPrice);
      if (starting) stats.startingPrices++;
      if (!price) stats.noPrice++;
      rows.push({
        Name: name, Category: cat.name, Price: price, Type: 'Simple',
        'Option 1': '', 'Option 1 Value': '',
        Duration: text(item.caption), 'Price Note': starting ? STARTING_PRICE_NOTE : '',
      });
    }
  }
  stats.rows = rows.length;
  return { rows, stats };
}
