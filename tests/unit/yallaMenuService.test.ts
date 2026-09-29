import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { yallaMenuSource } from '../../utils/yallaMenu';
import {
  fetchYallaMenu, YallaMenuTimeoutError, YALLA_REQUEST_TIMEOUT_MS, YALLA_MENU_TIMEOUT_MS, type FetchLike,
} from '../../services/yallaMenuService';

/** Real data from kelah.yallaqrcodes.com (2026-09-29), trimmed — see the fixture's `_source`. */
const FX = JSON.parse(readFileSync(new URL('../fixtures/yalla-kelah.json', import.meta.url), 'utf-8'));
const ITEMS = FX.items.data;
const PAGE = 'https://kelah.yallaqrcodes.com/branch/1/';
const SRC = yallaMenuSource(PAGE)!;

const bodyFor = (url: string) => {
  const path = new URL(url).pathname;
  return path === '/api/categories/' ? FX.categories
    : path === '/api/items-light/' ? FX.items
    : FX.details[/\/api\/items\/(\d+)\//.exec(path)![1]];
};

/** A fetch that answers from the fixture, optionally failing or HANGING some URLs. */
const fakeFetch = (opts: { fail?: (url: string) => boolean; hang?: (url: string) => boolean; hangBody?: (url: string) => boolean } = {}) => {
  const calls: { url: string; branch?: string; signal?: AbortSignal }[] = [];
  const fn: FetchLike = async (url, init) => {
    calls.push({ url, branch: init?.headers?.branch, signal: init?.signal });
    if (opts.hang?.(url)) return new Promise(() => {}); // never settles, ignores the signal
    if (opts.fail?.(url)) return { ok: false, status: 500, json: async () => ({}) };
    return { ok: true, status: 200, json: () => (opts.hangBody?.(url) ? new Promise(() => {}) : Promise.resolve(bodyFor(url))) };
  };
  return { fn, calls };
};

afterEach(() => { vi.useRealTimers(); });

describe('fetchYallaMenu — the network read (moved from utils/, behaviour unchanged)', () => {
  it('reads the sections, the items and EVERY item’s options, sending the branch header', async () => {
    const { fn, calls } = fakeFetch();
    const { text, stats, failedDetails } = await fetchYallaMenu(SRC, PAGE, fn);
    expect(failedDetails).toBe(0);
    expect(stats.withVariants).toBe(5);
    expect(text).toContain('Option 1 Value: إبريق صغير | Price: 15.00');
    expect(calls.filter((c) => c.url.includes('/api/items/'))).toHaveLength(ITEMS.length);
    expect(calls.every((c) => c.branch === '1')).toBe(true);
    expect(calls.every((c) => c.signal instanceof AbortSignal)).toBe(true);
  });

  it('a failed item detail leaves that item without variants instead of failing the scrape', async () => {
    const { fn } = fakeFetch({ fail: (u) => u.endsWith('/api/items/127/') });
    const { text, failedDetails } = await fetchYallaMenu(SRC, PAGE, fn);
    expect(failedDetails).toBe(1);
    expect(text).toContain('- شاي أحمر | Price: (no price listed on the menu)');
  });

  it('a failed listing throws, so the caller can fall back to the page text', async () => {
    const { fn } = fakeFetch({ fail: (u) => u.endsWith('/api/items-light/') });
    await expect(fetchYallaMenu(SRC, PAGE, fn)).rejects.toThrow(/items-light.*500/);
  });
});

describe('fetchYallaMenu — timeouts (the scrape can never hang on the menu API)', () => {
  it('the timeouts are explicit: 8 s per request, 30 s for the whole read', () => {
    expect(YALLA_REQUEST_TIMEOUT_MS).toBe(8_000);
    expect(YALLA_MENU_TIMEOUT_MS).toBe(30_000);
  });

  it('a HUNG listing request times out at the request limit and throws a timeout error', async () => {
    vi.useFakeTimers();
    const { fn, calls } = fakeFetch({ hang: (u) => u.endsWith('/api/items-light/') });
    const pending = fetchYallaMenu(SRC, PAGE, fn).then(() => null, (e) => e);
    await vi.advanceTimersByTimeAsync(YALLA_REQUEST_TIMEOUT_MS - 1);
    let settled = false;
    void pending.then(() => { settled = true; });
    await Promise.resolve();
    expect(settled).toBe(false); // not before the limit
    await vi.advanceTimersByTimeAsync(1);
    const err = await pending;
    expect(err).toBeInstanceOf(YallaMenuTimeoutError);
    expect(err.message).toMatch(/items-light.*8000 ms/);
    // The hung request was ABORTED, not left running.
    expect(calls.find((c) => c.url.endsWith('/api/items-light/'))!.signal!.aborted).toBe(true);
  });

  it('a body that never finishes is bounded too', async () => {
    vi.useFakeTimers();
    const { fn } = fakeFetch({ hangBody: (u) => u.endsWith('/api/categories/') });
    const pending = fetchYallaMenu(SRC, PAGE, fn).then(() => null, (e) => e);
    await vi.advanceTimersByTimeAsync(YALLA_REQUEST_TIMEOUT_MS);
    expect(await pending).toBeInstanceOf(YallaMenuTimeoutError);
  });

  it('a hung item DETAIL only loses that item’s options; the rest of the menu still comes back', async () => {
    vi.useFakeTimers();
    const { fn } = fakeFetch({ hang: (u) => u.endsWith('/api/items/127/') });
    const pending = fetchYallaMenu(SRC, PAGE, fn);
    await vi.advanceTimersByTimeAsync(YALLA_REQUEST_TIMEOUT_MS);
    const { text, failedDetails } = await pending;
    expect(failedDetails).toBe(1);
    expect(text).toContain('- شاي أحمر | Price: (no price listed on the menu)');
    expect(text).toContain('VARIANT مارجريتا');
  });

  it('the WHOLE read is capped: details that are each within the limit but together too slow → timeout, nothing partial', async () => {
    vi.useFakeTimers();
    // Every detail takes 7 s — under the 8 s request limit — so only the total cap can stop it.
    const slow: FetchLike = async (url, init) => {
      if (url.includes('/api/items/')) {
        await new Promise((r) => setTimeout(r, 7_000));
        if (init?.signal?.aborted) throw new Error('aborted');
      }
      return { ok: true, status: 200, json: async () => bodyFor(url) };
    };
    const pending = fetchYallaMenu(SRC, PAGE, slow, { concurrency: 1 }).then(() => null, (e) => e);
    await vi.advanceTimersByTimeAsync(YALLA_MENU_TIMEOUT_MS + 8_000);
    const err = await pending;
    expect(err).toBeInstanceOf(YallaMenuTimeoutError);
    expect(err.message).toMatch(/longer than 30000 ms/);
  });

  it('no timer is left running after a successful read', async () => {
    vi.useFakeTimers();
    const { fn } = fakeFetch();
    await fetchYallaMenu(SRC, PAGE, fn);
    expect(vi.getTimerCount()).toBe(0);
  });
});
