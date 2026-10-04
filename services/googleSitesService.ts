/**
 * Reads a published Google Site's menu for Web Scraper. The parsing lives in
 * `utils/googleSites.ts`, which is pure; this module is only the I/O.
 *
 * PAGES. The pasted page, then the same-site pages its content links to (one
 * level, in link order, each once, at most MAX_LINKED_PAGES), each through Jina
 * in HTML mode: Google Sites pages carry no CORS header, so the browser cannot
 * read them itself, and Jina answers this site's origin. Only the published,
 * public page is requested — no Google editor or private endpoint, no login.
 *
 * IMAGES. Only when no page has menu text: the content images that are not
 * links (a linked image is a navigation button), across the pages read, in
 * order, each once, at most MAX_OCR_IMAGES. Their bytes come straight from
 * Google (sites.google.com answers images with `Access-Control-Allow-Origin:
 * *`), and each goes to `readImage` — the app's model abstraction, injected.
 *
 * Every failure that leaves no rows throws GoogleSitesError, and the caller
 * falls back to the existing page-text scrape.
 */
import {
  parseGoogleSitesHtml, pageMenuRows, pageScript, pageKey, imageKey, isSameSite, isGoogleImage, dedupeRows, rowsFromOcrAnswer, sitesStats,
  OCR_PROMPT, MAX_LINKED_PAGES, MAX_OCR_IMAGES,
  type GoogleSitesLink, type ParsedSitesPage, type PageReport, type SitesRow, type SitesStats, type Script, type SitesImage,
} from '../utils/googleSites';

/** One page, rendered by Jina; measured at about 1 s on the test site. */
export const SITES_PAGE_TIMEOUT_MS = 30_000;
/** All page reads together; pages not reached by then are listed as not read. */
export const SITES_TOTAL_TIMEOUT_MS = 90_000;
/** Downloading one image. */
export const SITES_IMAGE_TIMEOUT_MS = 20_000;
/** Reading one image with the model. */
export const SITES_OCR_TIMEOUT_MS = 180_000;
/** Larger images are not sent to the model. */
export const SITES_MAX_IMAGE_BYTES = 8 * 1024 * 1024;

export type FetchLike = (
  url: string,
  init?: { headers?: Record<string, string>; signal?: AbortSignal },
) => Promise<{
  ok: boolean;
  status: number;
  text(): Promise<string>;
  arrayBuffer?(): Promise<ArrayBuffer>;
  headers?: { get(name: string): string | null };
}>;

/** One image to the model: base64 bytes, their type, the instruction → the model's text. */
export type ReadImage = (data: string, mimeType: string, prompt: string) => Promise<string>;

export class GoogleSitesError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = 'GoogleSitesError';
    if (options?.cause !== undefined) (this as { cause?: unknown }).cause = options.cause;
  }
}

export interface GoogleSitesResult {
  siteName: string;
  rows: SitesRow[];
  pages: PageReport[];
  unparsed: { page: string; text: string }[];
  /** Per-image problems that did not stop the read. */
  warnings: string[];
  stats: SitesStats;
  script: Script | null;
}

export interface GoogleSitesOptions {
  /** Absent: images are never read (and no model is ever called). */
  readImage?: ReadImage;
  onProgress?: (message: string) => void;
  pageTimeoutMs?: number;
  totalTimeoutMs?: number;
  imageTimeoutMs?: number;
  ocrTimeoutMs?: number;
  now?: () => number;
}

/** `fetch` rejects an aborted request with the signal's reason, an `AbortError`. */
const isAbort = (e: unknown, signal: AbortSignal): boolean =>
  e === signal.reason || (e instanceof Error && e.name === 'AbortError');

/**
 * `run` with an abort signal that fires after `ms`. A timeout is reported only
 * when OUR timer fired and the error is the abort it caused; anything else is
 * reported as itself.
 */
async function withTimeout<T>(ms: number, what: string, run: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, ms);
  try {
    return await run(controller.signal);
  } catch (e) {
    if (timedOut && isAbort(e, controller.signal)) throw new GoogleSitesError(`${what} did not answer within ${Math.round(ms / 1000)} s.`);
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

/** A promise that cannot be aborted (the model call), bounded all the same. */
async function race<T>(ms: number, what: string, p: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const limit = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new GoogleSitesError(`${what} did not answer within ${Math.round(ms / 1000)} s.`)), ms);
  });
  try {
    return await Promise.race([p, limit]);
  } finally {
    clearTimeout(timer);
  }
}

const message = (e: unknown): string => (e instanceof Error ? e.message : String(e));

async function readPage(url: string, fetchFn: FetchLike, timeoutMs: number): Promise<ParsedSitesPage> {
  return withTimeout(timeoutMs, 'The page', async (signal) => {
    const res = await fetchFn(`https://r.jina.ai/${url}`, {
      headers: {
        'X-Return-Format': 'html',
        // A fresh copy: a cached one can predate the site's current menu.
        'X-No-Cache': 'true',
        'X-Timeout': String(Math.floor(timeoutMs / 1000)),
      },
      signal,
    });
    if (!res.ok) throw new GoogleSitesError(`The page answered ${res.status}.`);
    const page = parseGoogleSitesHtml(await res.text(), url);
    if (!page) throw new GoogleSitesError('The answer was not a published Google Sites page.');
    return page;
  });
}

const toBase64 = (buf: ArrayBuffer): string => {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
};

async function readImageBytes(src: string, fetchFn: FetchLike, timeoutMs: number): Promise<{ data: string; mimeType: string }> {
  if (!isGoogleImage(src)) throw new GoogleSitesError(`It is not hosted by Google (${new URL(src).hostname}), so it is not downloaded.`);
  return withTimeout(timeoutMs, 'The image', async (signal) => {
    const res = await fetchFn(src, { signal });
    if (!res.ok) throw new GoogleSitesError(`The image answered ${res.status}.`);
    const mimeType = (res.headers?.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
    if (!/^image\/(png|jpe?g|webp|gif)$/.test(mimeType)) throw new GoogleSitesError(`Not a readable image (${mimeType || 'no type'}).`);
    if (!res.arrayBuffer) throw new GoogleSitesError('The image could not be read.');
    const buf = await res.arrayBuffer();
    if (buf.byteLength > SITES_MAX_IMAGE_BYTES) throw new GoogleSitesError('The image is too large to read.');
    return { data: toBase64(buf), mimeType };
  });
}

export async function fetchGoogleSitesMenu(
  link: GoogleSitesLink,
  fetchFn: FetchLike,
  options: GoogleSitesOptions = {},
): Promise<GoogleSitesResult> {
  const pageTimeout = options.pageTimeoutMs ?? SITES_PAGE_TIMEOUT_MS;
  const totalTimeout = options.totalTimeoutMs ?? SITES_TOTAL_TIMEOUT_MS;
  const now = options.now ?? (() => Date.now());
  const progress = options.onProgress ?? (() => undefined);
  const started = now();

  // 1. The pasted page. Its failure is the whole read's failure.
  const first = await readPage(link.url, fetchFn, pageTimeout);
  const read: { page: ParsedSitesPage; rows: SitesRow[]; unparsed: string[] }[] = [{ page: first, ...pageMenuRows(first) }];
  // Only the pages over the limit, until the end (see below).
  const reports: PageReport[] = [];

  // 2. The same-site pages its content links to: one level, each once, in order.
  const seen = new Set([pageKey(first.url)]);
  const linked: string[] = [];
  for (const href of first.links) {
    if (!isSameSite(href, link.site)) continue;
    const u = new URL(href);
    u.search = '';
    u.hash = '';
    const clean = u.href.replace(/\/+$/, '');
    const key = pageKey(clean);
    if (seen.has(key)) continue;
    seen.add(key);
    linked.push(clean);
  }
  const toRead = linked.slice(0, MAX_LINKED_PAGES);
  for (const url of linked.slice(MAX_LINKED_PAGES)) {
    reports.push({ url, name: '', status: 'not read: limit', rows: 0, note: `Only the first ${MAX_LINKED_PAGES} linked pages are read.` });
  }
  const pageReports = new Map<string, PageReport>();
  for (const [i, url] of toRead.entries()) {
    if (now() - started > totalTimeout) {
      pageReports.set(url, { url, name: '', status: 'not read: limit', rows: 0, note: `The ${Math.round(totalTimeout / 1000)} s limit for reading pages was reached.` });
      continue;
    }
    progress(`Reading linked page ${i + 1} of ${toRead.length}…`);
    try {
      const page = await readPage(url, fetchFn, pageTimeout);
      read.push({ page, ...pageMenuRows(page) });
    } catch (e) {
      pageReports.set(url, { url, name: '', status: 'failed', rows: 0, note: message(e) });
    }
  }

  // 3. One language: the pasted page's. The other edition is listed, not merged.
  const script = pageScript(first, read[0].rows);
  let rows: SitesRow[] = [];
  const unparsed: { page: string; text: string }[] = [];
  const kept: ParsedSitesPage[] = [];
  for (const r of read) {
    const s = pageScript(r.page, r.rows);
    const base = { url: r.page.url, name: r.page.pageName };
    if (r !== read[0] && script && s && s !== script) {
      pageReports.set(r.page.url, { ...base, status: 'other language', rows: 0, note: r.rows.length ? `${r.rows.length} rows in the other language edition were not added.` : 'A page of the other language edition; not followed further.' });
      continue;
    }
    kept.push(r.page);
    rows.push(...r.rows);
    unparsed.push(...r.unparsed.map((text) => ({ page: r.page.pageName, text })));
    pageReports.set(r.page.url, { ...base, status: r.rows.length ? 'read' : 'no menu', rows: r.rows.length, note: '' });
  }
  // The pasted page, the linked pages in link order, then those over the limit.
  reports.unshift(...[first.url, ...toRead].map((url) => pageReports.get(url)).filter((r): r is PageReport => !!r));

  // 4. No menu text anywhere: read the content images.
  const warnings: string[] = [];
  let imagesRead = 0;
  let modelCalls = 0;
  if (rows.length === 0) {
    if (!options.readImage) throw new GoogleSitesError('No menu text was found on the site, and images are not read here.');
    const images: { image: SitesImage; page: ParsedSitesPage }[] = [];
    const seenImages = new Set<string>();
    for (const page of kept) {
      for (const image of page.images) {
        if (image.link) continue; // a button: navigation, not content
        const key = imageKey(image.src);
        if (seenImages.has(key)) continue;
        seenImages.add(key);
        images.push({ image, page });
      }
    }
    if (images.length === 0) throw new GoogleSitesError('No menu text and no content images were found on the site.');
    if (images.length > MAX_OCR_IMAGES) warnings.push(`Only the first ${MAX_OCR_IMAGES} of ${images.length} images were read.`);
    for (const [i, { image, page }] of images.slice(0, MAX_OCR_IMAGES).entries()) {
      progress(`Reading image ${i + 1} of ${Math.min(images.length, MAX_OCR_IMAGES)} with AI…`);
      let bytes: { data: string; mimeType: string };
      try {
        bytes = await readImageBytes(image.src, fetchFn, options.imageTimeoutMs ?? SITES_IMAGE_TIMEOUT_MS);
      } catch (e) {
        warnings.push(`Image ${i + 1} on "${page.pageName}" could not be downloaded: ${message(e)}`);
        continue;
      }
      let answer: string;
      modelCalls++;
      try {
        answer = await race(options.ocrTimeoutMs ?? SITES_OCR_TIMEOUT_MS, 'The AI model', options.readImage(bytes.data, bytes.mimeType, OCR_PROMPT));
      } catch (e) {
        // A model problem (no key, no quota, timeout) is not about this image:
        // stop, keep nothing half-read, and let the caller fall back.
        throw new GoogleSitesError(`Reading the menu images failed: ${message(e)}`, { cause: e });
      }
      imagesRead++;
      try {
        const got = rowsFromOcrAnswer(answer, page.pageName);
        rows.push(...got.rows);
        if (got.rejected) warnings.push(`Image ${i + 1} on "${page.pageName}": ${got.rejected} unreadable entries were left out.`);
      } catch (e) {
        warnings.push(`Image ${i + 1} on "${page.pageName}": the AI answer could not be used (${message(e)}).`);
      }
    }
    if (rows.length === 0) throw new GoogleSitesError('No menu items were found in the site\'s text or images.');
  }

  const deduped = dedupeRows(rows);
  rows = deduped.rows;
  const stats = sitesStats(rows, {
    pages: kept.length,
    duplicatesDropped: deduped.dropped,
    unparsed: unparsed.length,
    imagesRead,
    modelCalls,
  });
  return { siteName: first.siteName, rows, pages: reports, unparsed, warnings, stats, script };
}
