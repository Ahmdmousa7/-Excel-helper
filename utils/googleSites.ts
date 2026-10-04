/**
 * Published Google Sites menus for Web Scraper: link detection, the page's
 * own content read into lines / images / links, and menu lines turned straight
 * into rows. Pure — no network — so it is tested against a real capture
 * (`tests/fixtures/google-sites/`); the I/O lives in
 * `services/googleSitesService.ts`.
 *
 * HOW A PUBLISHED GOOGLE SITE IS BUILT (measured on
 * sites.google.com/view/nightback, 2026-10-01). Every page is server-rendered
 * HTML. The site navigation sits in `<header>`/`<nav>`; the page's own content
 * is its `<section>` blocks. Text boxes are `<p>` elements, one per line,
 * whose words are split over styled `<span>`s (joined, they read normally).
 * Images are `<img src="https://sites.google.com/sitesv-images-rt/…=w1280">`,
 * and a button or a linked image is an `<a href="/view/<site>/<page>">`.
 * There are no `<h1>`…`<h6>`: a heading is a line without a price.
 *
 * WHERE NIGHT BACK'S MENU IS. The pasted page (`main-menu`) is a hub: a logo,
 * five category BUTTONS that are images linking to the category pages, a promo
 * photo and an offer banner. The menu itself is TEXT on those category pages
 * (`Red tea ……… 7 Riyal`). So the page text is read first and no model is
 * needed; images are read by OCR only when no menu text is found anywhere.
 *
 * WHICH PAGES. The pasted page and the same-site pages its CONTENT links to
 * (not the site navigation), one level deep, in link order, each once, at most
 * MAX_LINKED_PAGES. Never a crawl of the whole site.
 *
 * ARABIC / ENGLISH. Night Back has an English and an Arabic edition, and they
 * are NOT translations of each other (Pepsi is 10 Riyal in one and 7 in the
 * other; the Arabic shisha list has a VIP item the English one lacks). Rows are
 * never merged across languages and never translated: the scrape keeps the
 * language of the page that was pasted, and a linked page whose menu is in the
 * other language is skipped and listed as such.
 */
import { FRESHA_COLUMNS, STARTING_PRICE_NOTE } from './freshaVenue';

export { STARTING_PRICE_NOTE };

/** The scraper's menu columns, the same set and order as Fresha's. */
export const GOOGLE_SITES_COLUMNS = FRESHA_COLUMNS;

/** Linked pages read after the pasted one, at most. */
export const MAX_LINKED_PAGES = 12;
/** Images read by OCR, at most, when no page has menu text. */
export const MAX_OCR_IMAGES = 8;

export type SitesRow = Record<(typeof GOOGLE_SITES_COLUMNS)[number], string | number>;

export interface GoogleSitesLink {
  /** `https://sites.google.com/view/<site>/<page>`: no query, no fragment, no trailing slash. */
  url: string;
  /** `/view/<site>` (or `/<domain>/<site>` for a Workspace site): what makes a link "the same site". */
  site: string;
}

const SITES_HOST = 'sites.google.com';
const DOMAIN_SEGMENT = /^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/i;

/**
 * The published Google Sites page a link points to, or null when it is not one.
 *
 *   https://sites.google.com/view/<site>[/<page>…]       (consumer sites)
 *   https://sites.google.com/<domain.tld>/<site>[/<page>…] (Workspace sites)
 *
 * Anything else on the host — the editor (`/d/…/edit`, `/u/0/…`, `/new`),
 * Google's own `/_/` endpoints — and every other Google host is rejected. The
 * query and fragment are dropped; the page path is kept as it is.
 */
export function googleSitesPage(link: string): GoogleSitesLink | null {
  let u: URL;
  try {
    u = new URL(link.trim());
  } catch {
    return null;
  }
  if (!/^https?:$/.test(u.protocol) || u.hostname.toLowerCase() !== SITES_HOST || u.port) return null;
  const segs = u.pathname.split('/').filter(Boolean);
  if (segs.length < 2) return null;
  if (segs[0] !== 'view' && !DOMAIN_SEGMENT.test(segs[0])) return null;
  if (segs.some((s) => s.startsWith('_') || s === 'edit')) return null;
  return { url: `https://${SITES_HOST}/${segs.join('/')}`, site: `/${segs[0]}/${segs[1]}` };
}

/** One identity per page: decoded, NFC, case-insensitive, no trailing slash. */
export function pageKey(url: string): string {
  try {
    const u = new URL(url);
    let path = u.pathname;
    try {
      path = decodeURIComponent(path);
    } catch {
      /* keep it encoded */
    }
    return `${u.hostname.toLowerCase()}${path.normalize('NFC').toLowerCase().replace(/\/+$/, '')}`;
  } catch {
    return url;
  }
}

/** One identity per image: Google's size suffix (`=w1280`, `=s400`…) dropped. */
export function imageKey(src: string): string {
  return src.replace(/=[ws]\d+[^/]*$/, '');
}

/** True when `url` is a page of the site `site` (`/view/<site>`). */
export function isSameSite(url: string, site: string): boolean {
  try {
    const u = new URL(url);
    if (u.hostname.toLowerCase() !== SITES_HOST) return false;
    const p = u.pathname.replace(/\/+$/, '');
    return (p === site || p.startsWith(`${site}/`)) && !p.split('/').some((s) => s.startsWith('_'));
  } catch {
    return false;
  }
}

export interface SitesImage {
  src: string;
  /** Where clicking it goes, when it is a link (a navigation button). */
  link: string | null;
}

export interface ParsedSitesPage {
  url: string;
  siteName: string;
  pageName: string;
  /** The content's text lines, in order, without link and button labels. */
  lines: string[];
  images: SitesImage[];
  /** Links in the content, absolute, in order (duplicates kept; callers dedupe). */
  links: string[];
}

const resolve = (href: string | null, base: string): string | null => {
  if (!href) return null;
  try {
    const u = new URL(href, base);
    return /^https?:$/.test(u.protocol) ? u.href : null;
  } catch {
    return null;
  }
};

/**
 * A published Google Sites page's content, or null when the HTML is not one
 * (not served from sites.google.com, or no content sections) — the
 * caller then falls back. `parse` is the browser's DOMParser by default.
 */
export function parseGoogleSitesHtml(
  html: string,
  pageUrl: string,
  parse: (html: string) => Document = (h) => new DOMParser().parseFromString(h, 'text/html'),
): ParsedSitesPage | null {
  const doc = parse(html);
  const ogUrl = doc.querySelector('meta[property="og:url"]')?.getAttribute('content') ?? '';
  if (!ogUrl.startsWith(`https://${SITES_HOST}/`)) return null;
  // The content is the page's `<section>` blocks outside the header and the
  // navigation. Not `[role="main"]`: on Night Back's hub that is only the
  // first text box, and the buttons, the offer and the links sit after it.
  const inContent = (el: Element) => !el.closest('header, nav') && !!el.closest('section');
  if (!Array.from(doc.querySelectorAll('section')).some(inContent)) return null;
  const all = (selector: string) => Array.from(doc.querySelectorAll(selector)).filter(inContent);

  // "<site name> - <page name>"
  const title = doc.querySelector('meta[property="og:title"]')?.getAttribute('content') ?? doc.title ?? '';
  const cut = title.lastIndexOf(' - ');
  const siteName = clean(cut > 0 ? title.slice(0, cut) : title);
  const pageName = clean(cut > 0 ? title.slice(cut + 3) : title);

  const lines: string[] = [];
  for (const p of all('p')) {
    // A button's or a link's label is navigation, not menu text.
    if (p.closest('a, [role="button"], nav')) continue;
    const copy = p.cloneNode(true) as Element;
    copy.querySelectorAll('br').forEach((br) => br.replaceWith('\n'));
    for (const line of (copy.textContent ?? '').split('\n')) {
      if (line.trim()) lines.push(line);
    }
  }

  const images: SitesImage[] = [];
  for (const img of all('img')) {
    const src = resolve(img.getAttribute('src'), pageUrl);
    if (!src) continue;
    images.push({ src, link: resolve(img.closest('a[href]')?.getAttribute('href') ?? null, pageUrl) });
  }

  const links: string[] = [];
  for (const a of all('a[href]')) {
    const href = resolve(a.getAttribute('href'), pageUrl);
    if (href) links.push(href);
  }

  return { url: pageUrl, siteName, pageName, lines, images, links };
}

// ─── Lines → rows ────────────────────────────────────────────────────────────

/**
 * Whitespace collapsed, invisible direction marks dropped, Arabic tatweel
 * (ـ, a stretching stroke with no letter value: `بيبســــــي` = `بيبسي`)
 * removed, and a stray combining mark at the start (`ٍShisha`) dropped. The
 * words themselves are never changed.
 */
export function clean(s: string): string {
  return s
    .replace(/\u0640/g, '')
    .replace(/[\u00a0\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\p{M}+\s*/u, '');
}

/** Arabic-Indic and Persian digits as ASCII, the Arabic decimal point as `.`. */
const asciiDigits = (s: string): string =>
  s
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[\u06f0-\u06f9]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/\u066b/g, '.');

const CURRENCY = String.raw`(?:riyals?|rials?|sar|s\.r\.?|sr|ر\.?\s?س\.?|ريالا?ت?|رس)`;
const FROM = String.raw`(?:from|starting (?:at|from)|starts (?:at|from)|يبدأ من|تبدأ من|ابتداء(?:ا|\u064b)? من|من)`;
const LEADER_CHARS = String.raw`.…·•_=:\-–—`;
const NUMBER = String.raw`\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\d+(?:[.,]\d{1,2})?`;
/**
 * `Name …… [from] [SAR] 12[.50] [Riyal]`. The name must end in a real
 * character, and something must separate it from the price: a dotted leader
 * (spaces inside it allowed: `Yanson tea … ……...... 7`), a lone dash or colon
 * between spaces (`Tea - 7 SAR`), or whitespace.
 */
const ITEM = new RegExp(
  String.raw`^(.*?[^\s${LEADER_CHARS}])(?:\s*([${LEADER_CHARS}][${LEADER_CHARS}\s]*[${LEADER_CHARS}])\s*|\s+([\-–—:])\s+|\s+)(?:(${FROM})\s+)?(?:(${CURRENCY})\s*)?(${NUMBER})\s*(${CURRENCY})?\.?$`,
  'iu',
);
const HAS_CURRENCY = new RegExp(String.raw`\d\s*${CURRENCY}(?![\p{L}])|${CURRENCY}\s*\d`, 'iu');
const DURATION = /(\d+(?:[.,]\d+)?\s*(?:minutes?|mins?|hours?|hrs?|دقيقة|دقائق|ساعة|ساعات))(?![\p{L}])/iu;

export type LineKind =
  | { kind: 'item'; name: string; price: number; starting: boolean; duration: string }
  | { kind: 'heading'; text: string }
  | { kind: 'unparsed'; text: string }
  | { kind: 'ignored' };

const letters = (s: string): number => (s.match(/\p{L}/gu) ?? []).length;

const toNumber = (raw: string): number => {
  const n = /,\d{3}(?:\D|$)/.test(raw) ? Number(raw.replace(/,/g, '')) : Number(raw.replace(',', '.'));
  return n;
};

/**
 * What one content line is. An `item` needs a single price and either a
 * dotted leader or a currency; a line that LOOKS priced but does not fit that
 * shape (a range `20 - 30`, two prices on one line, `= 39 Riyal only`) is
 * `unparsed` — reported, never guessed. A short line with no price is a
 * `heading`. A two-column table header (`Item          Price`) and anything
 * else is `ignored`.
 */
export function classifyLine(raw: string): LineKind {
  // A table header: two labels pushed apart by a run of spaces, no price.
  const wideGap = /\S[\s\u00a0]{4,}\S/.test(raw.trim());
  const text = asciiDigits(clean(raw));
  if (!text) return { kind: 'ignored' };

  const m = ITEM.exec(text);
  const hasLeader = new RegExp(`[${LEADER_CHARS}]{2,}`).test(text);
  // A trailing bare number (`Caesar salad 25`) may be a price or a quantity:
  // reported, not read as a price and not used as a heading.
  const looksPriced = /\d/.test(text) && (hasLeader || HAS_CURRENCY.test(text) || /\p{L}.*\s\d+(?:[.,]\d+)?$/u.test(text));
  if (m) {
    const [, name, dots, dash, from, curBefore, num, curAfter] = m;
    const leader = dots || dash;
    const sound =
      (leader || curBefore || curAfter) &&
      letters(name) > 0 &&
      // Another leader or another price inside the name = several prices on one line.
      !/[.…]{3,}/.test(name) &&
      !HAS_CURRENCY.test(name);
    const price = toNumber(num);
    if (sound && Number.isFinite(price)) {
      const d = DURATION.exec(name);
      return { kind: 'item', name: name.trim(), price, starting: Boolean(from), duration: d ? d[1] : '' };
    }
  }
  if (looksPriced) return { kind: 'unparsed', text };
  if (wideGap) return { kind: 'ignored' };
  if (letters(text) >= 2 && text.length <= 60 && !/[.!?؟]$/.test(text)) return { kind: 'heading', text };
  return { kind: 'ignored' };
}

export function sitesRow(name: string, category: string, price: number | '', starting: boolean, duration: string): SitesRow {
  return {
    Name: name, Category: category, Price: price, Type: 'Simple',
    'Option 1': '', 'Option 1 Value': '',
    Duration: duration, 'Price Note': starting ? STARTING_PRICE_NOTE : '',
  };
}

/**
 * The menu rows in one page's text, in page order. The category is the latest
 * heading line above an item, and the page's own name before any heading.
 */
export function pageMenuRows(page: ParsedSitesPage): { rows: SitesRow[]; unparsed: string[] } {
  const rows: SitesRow[] = [];
  const unparsed: string[] = [];
  let category = page.pageName;
  for (const line of page.lines) {
    const c = classifyLine(line);
    if (c.kind === 'heading') category = c.text;
    else if (c.kind === 'item') rows.push(sitesRow(c.name, category, c.price, c.starting, c.duration));
    else if (c.kind === 'unparsed') unparsed.push(c.text);
  }
  return { rows, unparsed };
}

// ─── Language ────────────────────────────────────────────────────────────────

export type Script = 'arabic' | 'latin';

/** The script most of the letters are in, or null when there are none. */
export function scriptOf(text: string): Script | null {
  const arabic = (text.match(/\p{Script=Arabic}/gu) ?? []).length;
  const latin = (text.match(/[A-Za-z]/g) ?? []).length;
  if (!arabic && !latin) return null;
  return arabic > latin ? 'arabic' : 'latin';
}

/** A page's language: its menu names when it has a menu, otherwise its name. */
export function pageScript(page: ParsedSitesPage, rows: SitesRow[]): Script | null {
  return rows.length ? scriptOf(rows.map((r) => r.Name).join(' ')) : scriptOf(page.pageName);
}

// ─── Duplicates ──────────────────────────────────────────────────────────────

const rowKey = (r: SitesRow): string =>
  [r.Name, r.Category, r.Price, r['Option 1 Value']].map((v) => String(v).toLowerCase()).join('\u0001');

/** Rows with an exact repeat (same name, category, price and option) removed, first kept. */
export function dedupeRows(rows: SitesRow[]): { rows: SitesRow[]; dropped: number } {
  const seen = new Set<string>();
  const out: SitesRow[] = [];
  for (const r of rows) {
    const k = rowKey(r);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(r);
  }
  return { rows: out, dropped: rows.length - out.length };
}

// ─── OCR (images) ────────────────────────────────────────────────────────────

/**
 * The instruction for one menu image. Copy, never translate (the scraper keeps
 * the site's own text); a price only when one number is printed, never 0 for a
 * missing one; an empty list for a logo, a photo or a button.
 */
export const OCR_PROMPT = [
  'You are reading ONE image taken from a menu page of a website.',
  'If the image is not a menu or price list (a logo, a photo, a decorative banner, a navigation button, or an advert without a list of items with prices), return [].',
  'Otherwise return ONLY a JSON array with one object per menu item, in the order the image shows them:',
  '{"name": string, "category": string or null, "price": number or null, "startingPrice": boolean, "duration": string or null}',
  'Rules:',
  '- Copy every text exactly as printed, in its own language. Do NOT translate and do NOT add a second language.',
  '- "category" is the section heading the item is listed under, or null when there is none.',
  '- "price" only when exactly one number is printed as the item\'s price. Otherwise (no price, a range, several prices) use null. Never guess, never use 0 for a missing price.',
  '- "startingPrice" is true only when the price is printed as a starting price ("from", "starting at", "يبدأ من", "من").',
  '- "duration" only when a duration is printed for the item (for example "30 min"), otherwise null.',
  'Return the JSON array and nothing else.',
].join('\n');

/**
 * Rows from a model's answer for one image. Anything that is not an object
 * with a name is dropped and counted; a price that is not a clean number is
 * left empty. Throws when the answer is not a JSON array at all.
 */
export function rowsFromOcrAnswer(answer: string, defaultCategory: string): { rows: SitesRow[]; rejected: number } {
  const json = answer.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  const parsed: unknown = JSON.parse(json);
  if (!Array.isArray(parsed)) throw new Error('The image answer was not a list.');
  const rows: SitesRow[] = [];
  let rejected = 0;
  for (const e of parsed) {
    if (!e || typeof e !== 'object' || Array.isArray(e)) { rejected++; continue; }
    const o = e as Record<string, unknown>;
    const name = typeof o.name === 'string' ? clean(o.name) : '';
    if (!name) { rejected++; continue; }
    const category = typeof o.category === 'string' && clean(o.category) ? clean(o.category) : defaultCategory;
    let price: number | '' = '';
    if (typeof o.price === 'number' && Number.isFinite(o.price) && o.price >= 0) price = o.price;
    else if (typeof o.price === 'string' && /^\s*\d+(?:\.\d+)?\s*$/.test(asciiDigits(o.price))) price = Number(asciiDigits(o.price));
    const duration = typeof o.duration === 'string' ? clean(o.duration) : '';
    rows.push(sitesRow(name, category, price, o.startingPrice === true, duration));
  }
  return { rows, rejected };
}

// ─── Report ──────────────────────────────────────────────────────────────────

export type PageStatus = 'read' | 'no menu' | 'other language' | 'failed' | 'not read: limit';

export interface PageReport {
  url: string;
  name: string;
  status: PageStatus;
  rows: number;
  note: string;
}

export interface SitesStats {
  pages: number;
  rows: number;
  categories: number;
  startingPrices: number;
  noPrice: number;
  withDuration: number;
  duplicatesDropped: number;
  unparsed: number;
  imagesRead: number;
  modelCalls: number;
}

export function sitesStats(rows: SitesRow[], extra: Pick<SitesStats, 'pages' | 'duplicatesDropped' | 'unparsed' | 'imagesRead' | 'modelCalls'>): SitesStats {
  return {
    ...extra,
    rows: rows.length,
    categories: new Set(rows.map((r) => r.Category)).size,
    startingPrices: rows.filter((r) => r['Price Note'] === STARTING_PRICE_NOTE).length,
    noPrice: rows.filter((r) => r.Price === '').length,
    withDuration: rows.filter((r) => r.Duration !== '').length,
  };
}

/** The Web Scraper log line for a Google Sites read; a count of 0 is left out. */
export function googleSitesSummary(site: string, s: SitesStats): string {
  const parts = [`${s.rows} ${s.rows === 1 ? 'item' : 'items'} in ${s.categories} ${s.categories === 1 ? 'category' : 'categories'} from ${s.pages} ${s.pages === 1 ? 'page' : 'pages'}`];
  if (s.startingPrices) parts.push(`${s.startingPrices} with a starting price`);
  if (s.noPrice) parts.push(`${s.noPrice} with no price`);
  if (s.withDuration) parts.push(`${s.withDuration} with a duration`);
  if (s.duplicatesDropped) parts.push(`${s.duplicatesDropped} duplicate ${s.duplicatesDropped === 1 ? 'row' : 'rows'} removed`);
  if (s.imagesRead) parts.push(`${s.imagesRead} ${s.imagesRead === 1 ? 'image' : 'images'} read by AI`);
  return `Read the Google Site ${site}: ${parts.join(', ')}. The field selection does not apply: menu data has fixed columns.`;
}

/** The `Google Sites pages` sheet: every page considered, and every line not parsed. */
export function googleSitesReportSheet(pages: PageReport[], unparsed: { page: string; text: string }[]): string[][] {
  return [
    ['Page', 'Link', 'Status', 'Rows', 'Note'],
    ...pages.map((p) => [p.name, p.url, p.status, String(p.rows), p.note]),
    ...unparsed.map((u) => [u.page, '', 'line not parsed', '0', u.text]),
  ];
}
