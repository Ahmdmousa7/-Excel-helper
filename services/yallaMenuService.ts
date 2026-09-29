/**
 * Reads a Yalla QR Codes menu's own JSON over the network, for Web Scraper.
 *
 * The parsing and the text the model receives live in `utils/yallaMenu.ts`,
 * which is pure; this module is only the I/O: which endpoints, which header,
 * how many at once, and how long to wait.
 *
 * TIMEOUTS. Every failure here, a timeout included, makes the caller fall back
 * to the page-text scrape, so these bound how long a slow or hung menu API can
 * delay a scrape before that happens:
 *
 *   YALLA_REQUEST_TIMEOUT_MS  one request, including reading its body. The real
 *                             menu answers in well under a second; 8 s covers a
 *                             slow mobile connection without waiting forever.
 *   YALLA_MENU_TIMEOUT_MS     the whole read — sections, items and every item's
 *                             options (142 requests on the kelah menu, 6 at a
 *                             time; a few seconds in practice). 30 s is the
 *                             ceiling after which the menu data is abandoned.
 *
 * A timed-out request is ABORTED, not merely ignored, so nothing keeps running
 * after the fallback starts.
 */
import {
  yallaMenuText,
  type YallaSource, type YallaCategory, type YallaItem, type YallaDetail, type YallaMenuStats,
} from '../utils/yallaMenu';

export const YALLA_REQUEST_TIMEOUT_MS = 8_000;
export const YALLA_MENU_TIMEOUT_MS = 30_000;
/** Item-detail requests in flight at once. */
export const YALLA_DETAIL_CONCURRENCY = 6;

/** A menu-data request or the whole read took too long. The caller falls back. */
export class YallaMenuTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'YallaMenuTimeoutError';
  }
}

export type FetchLike = (
  url: string,
  init?: { headers?: Record<string, string>; signal?: AbortSignal },
) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

export interface YallaMenuOptions {
  requestTimeoutMs?: number;
  totalTimeoutMs?: number;
  concurrency?: number;
}

export interface YallaMenuResult {
  text: string;
  stats: YallaMenuStats;
  /** Item details that failed or timed out; those items are listed without options. */
  failedDetails: number;
}

/**
 * Read the whole menu. Item details are fetched for EVERY item, because the
 * light listing's `options_count` is 0 even for items that have options. A
 * detail that fails or times out leaves that item without variants (counted in
 * `failedDetails`); a failed or timed-out LISTING, or the whole read passing
 * `totalTimeoutMs`, throws so the caller can fall back to the page text.
 */
export async function fetchYallaMenu(
  src: YallaSource,
  pageUrl: string,
  fetchFn: FetchLike,
  options: YallaMenuOptions = {},
): Promise<YallaMenuResult> {
  const requestTimeoutMs = options.requestTimeoutMs ?? YALLA_REQUEST_TIMEOUT_MS;
  const totalTimeoutMs = options.totalTimeoutMs ?? YALLA_MENU_TIMEOUT_MS;
  const concurrency = options.concurrency ?? YALLA_DETAIL_CONCURRENCY;
  const headers: Record<string, string> = { accept: 'application/json', ...(src.branch ? { branch: src.branch } : {}) };

  // One deadline for the whole read. When it passes, every request still in
  // flight is aborted and no new one starts.
  const whole = new AbortController();
  const totalTimer = setTimeout(
    () => whole.abort(new YallaMenuTimeoutError(`menu data took longer than ${totalTimeoutMs} ms`)),
    totalTimeoutMs,
  );
  const aborted = () => (whole.signal.reason instanceof Error ? whole.signal.reason : new YallaMenuTimeoutError('menu data aborted'));

  /** GET one endpoint's `data`, bounded by the request timeout and the deadline. */
  const get = async (path: string): Promise<unknown> => {
    if (whole.signal.aborted) throw aborted();
    const one = new AbortController();
    const onWhole = () => one.abort(whole.signal.reason);
    whole.signal.addEventListener('abort', onWhole, { once: true });
    let timer: ReturnType<typeof setTimeout> | undefined;
    // A race rather than trusting the signal alone: a fetch that ignores its
    // signal, or a body that never finishes, must still not hang the scrape.
    const expired = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        const err = new YallaMenuTimeoutError(`${path} took longer than ${requestTimeoutMs} ms`);
        one.abort(err);
        reject(err);
      }, requestTimeoutMs);
      one.signal.addEventListener('abort', () => reject(one.signal.reason instanceof Error ? one.signal.reason : aborted()), { once: true });
    });
    const work = (async () => {
      const res = await fetchFn(`${src.origin}${path}`, { headers, signal: one.signal });
      if (!res.ok) throw new Error(`${path} returned HTTP ${res.status}`);
      const body = (await res.json()) as { data?: unknown };
      return body?.data;
    })();
    try {
      return await Promise.race([work, expired]);
    } finally {
      clearTimeout(timer);
      whole.signal.removeEventListener('abort', onWhole);
      work.catch(() => undefined); // the loser of the race must not surface as unhandled
    }
  };

  try {
    const [categories, items] = await Promise.all([get('/api/categories/'), get('/api/items-light/')]);
    if (!Array.isArray(categories) || !Array.isArray(items) || items.length === 0) throw new Error('menu data has no items');

    const details = new Map<number, YallaDetail>();
    let failedDetails = 0;
    const queue = (items as YallaItem[]).filter((i) => !i.is_deleted).map((i) => i.id);
    await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
      for (let id = queue.shift(); id !== undefined && !whole.signal.aborted; id = queue.shift()) {
        try { details.set(id, ((await get(`/api/items/${id}/`)) ?? {}) as YallaDetail); } catch { failedDetails++; }
      }
    }));
    // Past the deadline, the partial result is not used: fall back instead.
    if (whole.signal.aborted) throw aborted();

    const { text, stats } = yallaMenuText(categories as YallaCategory[], items as YallaItem[], details, pageUrl);
    return { text, stats, failedDetails };
  } finally {
    clearTimeout(totalTimer);
  }
}
