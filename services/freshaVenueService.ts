/**
 * Reads a Fresha venue page for Web Scraper. The parsing lives in
 * `utils/freshaVenue.ts`, which is pure; this module is only the I/O.
 *
 * ONE request: the PUBLIC venue page through Jina in HTML mode
 * (`X-Return-Format: html`), which keeps the page's embedded `__NEXT_DATA__`
 * and answers the browser with CORS for this site. Fresha's booking API is not
 * called: it only answers fresha.com, and it is not ours to work around.
 *
 * Every failure — network, timeout, a page without the expected data — throws,
 * and the caller falls back to the existing page-text scrape.
 */
import { parseFreshaVenueHtml, freshaRows, type FreshaRow, type FreshaStats } from '../utils/freshaVenue';

/** The venue page answers in a few seconds; Jina renders it first. */
export const FRESHA_TIMEOUT_MS = 45_000;

export type FetchTextLike = (
  url: string,
  init?: { headers?: Record<string, string>; signal?: AbortSignal },
) => Promise<{ ok: boolean; status: number; text(): Promise<string> }>;

export class FreshaVenueError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FreshaVenueError';
  }
}

export interface FreshaVenueResult {
  venue: string;
  rows: FreshaRow[];
  stats: FreshaStats;
}

export async function fetchFreshaVenue(
  venueUrl: string,
  fetchFn: FetchTextLike,
  timeoutMs: number = FRESHA_TIMEOUT_MS,
): Promise<FreshaVenueResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchFn(`https://r.jina.ai/${venueUrl}`, {
      headers: {
        'X-Return-Format': 'html',
        // A fresh copy: a cached one can predate the venue's current menu.
        'X-No-Cache': 'true',
        'X-Timeout': String(Math.floor(timeoutMs / 1000)),
      },
      signal: controller.signal,
    });
    if (!res.ok) throw new FreshaVenueError(`The venue page answered ${res.status}.`);
    const venue = parseFreshaVenueHtml(await res.text());
    if (!venue) throw new FreshaVenueError('The venue page did not contain its menu data.');
    const { rows, stats } = freshaRows(venue);
    return { venue: venue.name, rows, stats };
  } catch (e) {
    if (controller.signal.aborted) throw new FreshaVenueError(`The venue page did not answer within ${Math.round(timeoutMs / 1000)} s.`);
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
