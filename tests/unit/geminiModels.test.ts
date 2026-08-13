import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/**
 * Shared with the `@google/genai` mock below.
 *
 * `vi.hoisted` because `vi.mock` is lifted above every other statement in the
 * file — a plain `const` declared here would still be in its temporal dead zone
 * when the factory runs.
 */
const mockState = vi.hoisted(() => ({
  tried: [] as string[],
  working: '',
  retired: new Error('This model is no longer available. status: NOT_FOUND'),
}));

// Replaces the SDK so `verifyGeminiKey` — the real one — can be driven against a
// key for which only some models exist.
vi.mock('@google/genai', () => ({
  GoogleGenAI: class {
    models = {
      generateContent: async ({ model }: { model: string }) => {
        mockState.tried.push(model);
        if (mockState.working === '__quota__') throw new Error('429 quota exceeded');
        if (model !== mockState.working) throw mockState.retired;
        return { text: 'ok' };
      },
    };
  },
  Type: {},
}));

import {
  MODEL_CANDIDATES,
  resolveModel,
  retireModel,
  resetRetiredModels,
  isModelUnavailable,
  isKeyIssue,
  modelUnavailableError,
  verifyGeminiKey,
  translateBatch,
} from '../../services/geminiService';

/**
 * Model ids in this app are Google *preview* releases, and Google retires them.
 * On 2026-08-05 `gemini-3-pro-preview` was retired and every feature using it —
 * OCR on images, Compare's AI Analysis, Support Chat, and (that same day)
 * Translate and Web Scraper — started returning 404.
 *
 * The message below is the real one, copied from that failure. It is the input
 * these tests exist to pin: a detector that does not match it is worthless, and
 * one that also matches quota errors would send a rate-limited user down the
 * model-fallback path instead of rotating keys.
 */
const REAL_404 = JSON.stringify({
  error: {
    message: '{\n "error": {\n "code": 404,\n "message": "This model models/gemini-3-pro-preview is no longer available. Please update your code to use a newer model for the latest features and improvements. We recommend you to use the Interactions API (https://ai.google.dev/gemini-api/docs/migrate-to-interactions).",\n "status": "NOT_FOUND"\n }\n}\n',
    code: 404,
    status: '',
  },
});

describe('isModelUnavailable', () => {
  it('matches the real retirement error', () => {
    expect(isModelUnavailable(new Error(REAL_404))).toBe(true);
  });

  it('matches the phrasings Google uses for a missing model', () => {
    expect(isModelUnavailable(new Error('This model is no longer available.'))).toBe(true);
    expect(isModelUnavailable(new Error('status: NOT_FOUND'))).toBe(true);
    expect(isModelUnavailable(new Error('models/foo is not found'))).toBe(true);
    expect(isModelUnavailable(new Error('404 model not found'))).toBe(true);
  });

  it('does NOT match quota or auth failures', () => {
    // These must keep going down the key-rotation path. Treating a 429 as a
    // retired model would swap models on every rate limit and never rotate keys.
    for (const msg of [
      '429 Too Many Requests',
      'Resource exhausted (quota)',
      'rate limit exceeded',
      '401 Unauthorized',
      '403 Forbidden',
      'API key not valid',
    ]) {
      expect(isModelUnavailable(new Error(msg)), msg).toBe(false);
    }
  });

  it('does not confuse a plain 404 with a missing model', () => {
    // A 404 from some other resource should not trigger a model swap.
    expect(isModelUnavailable(new Error('404 Not Found: /v1beta/files/abc'))).toBe(false);
  });

  it('survives non-Error inputs', () => {
    expect(isModelUnavailable(undefined)).toBe(false);
    expect(isModelUnavailable(null)).toBe(false);
    expect(isModelUnavailable('no longer available')).toBe(true);
  });
});

describe('verifyGeminiKey walks past retired models', () => {
  /**
   * The highest-consequence behaviour in this change: Test is usually the FIRST
   * call after a page load, so the retired-model registry is still empty and it
   * meets the dead id itself. Before the fix it answered "invalid" — sending the
   * user to rotate a key that was never the problem.
   *
   * These call the REAL `verifyGeminiKey` against a mocked SDK. An earlier
   * version re-implemented the loop in the test instead, which meant all four
   * would have stayed green if the function were reverted to a single
   * `resolveModel()` call — a test that cannot fail proves nothing.
   */
  beforeEach(() => {
    mockState.tried.length = 0;
    resetRetiredModels();
  });

  it('reports VALID when only the last candidate survives', async () => {
    mockState.working = MODEL_CANDIDATES.fast[MODEL_CANDIDATES.fast.length - 1];
    expect(await verifyGeminiKey('AIzaKEY')).toBe('valid');
    expect(mockState.tried).toEqual([...MODEL_CANDIDATES.fast]);
  });

  it('reports VALID on the first candidate without trying the rest', async () => {
    mockState.working = MODEL_CANDIDATES.fast[0];
    expect(await verifyGeminiKey('AIzaKEY')).toBe('valid');
    expect(mockState.tried).toHaveLength(1);
  });

  it('reports invalid only after every candidate is gone', async () => {
    mockState.working = 'a-model-not-in-the-list';
    expect(await verifyGeminiKey('AIzaKEY')).toBe('invalid');
    expect(mockState.tried).toEqual([...MODEL_CANDIDATES.fast]);
  });

  it('does not strike ids off the shared registry', async () => {
    // Availability is per key and per project. The key under test is whatever
    // was typed into the modal, so retiring on its behalf could disable a model
    // for a different, working key.
    mockState.working = 'a-model-not-in-the-list';
    const before = resolveModel('fast');
    await verifyGeminiKey('AIzaKEY');
    expect(resolveModel('fast')).toBe(before);
  });

  it('reports quota without walking the list', async () => {
    // A rate limit says nothing about the model, so it must stop immediately
    // rather than burn every candidate.
    mockState.working = '__quota__';
    expect(await verifyGeminiKey('AIzaKEY')).toBe('quota');
    expect(mockState.tried).toHaveLength(1);
  });

  it('reports invalid for an empty key without calling the API', async () => {
    expect(await verifyGeminiKey('   ')).toBe('invalid');
    expect(mockState.tried).toHaveLength(0);
  });
});

describe('translateBatch reports a model fallback to its caller', () => {
  /**
   * The quality tier ends in Flash ids, so a Pro retirement degrades the run
   * instead of failing it — the right trade for a 500-row job, but it changes
   * the quality of every item after the switch. Before this, the only record was
   * a `console.warn`, which is to say no record at all: the exported workbook
   * looked identical to one produced entirely on Pro.
   */
  const originalLocalStorage = (globalThis as any).localStorage;

  beforeEach(() => {
    mockState.tried.length = 0;
    resetRetiredModels();
    // `environment: 'node'`, and `getAiClient()` reads the key from storage.
    (globalThis as any).localStorage = {
      getItem: (k: string) => (k === 'gemini_api_key' ? 'AIzaKEY' : ''),
      setItem: () => {},
    };
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    (globalThis as any).localStorage = originalLocalStorage;
    vi.restoreAllMocks();
  });

  const opts = (onNotice?: (m: string) => void) => ({
    sourceLang: 'en',
    targetLang: 'ar',
    domain: 'retail',
    glossary: [],
    onNotice,
  });

  it('names both the dead model and the one it moved to', async () => {
    mockState.working = MODEL_CANDIDATES.quality[1];
    const notices: string[] = [];
    await translateBatch([{ text: 'Blue Shirt' }], opts((m) => notices.push(m)));

    expect(notices).toHaveLength(1);
    expect(notices[0]).toContain(MODEL_CANDIDATES.quality[0]);
    expect(notices[0]).toContain(MODEL_CANDIDATES.quality[1]);
  });

  it('says quality may differ, since that is the consequence the user cares about', async () => {
    // The fallback list crosses from Pro to Flash. A notice that only named ids
    // would leave the reader to know which of those is the weaker model.
    mockState.working = MODEL_CANDIDATES.quality[MODEL_CANDIDATES.quality.length - 1];
    const notices: string[] = [];
    await translateBatch([{ text: 'Blue Shirt' }], opts((m) => notices.push(m)));

    expect(notices.length).toBeGreaterThan(0);
    expect(notices[notices.length - 1]).toMatch(/quality may differ/i);
  });

  it('stays silent when the preferred model answers', async () => {
    // A notice on every run is a notice nobody reads.
    mockState.working = MODEL_CANDIDATES.quality[0];
    const notices: string[] = [];
    await translateBatch([{ text: 'Blue Shirt' }], opts((m) => notices.push(m)));

    expect(notices).toEqual([]);
  });

  it('still translates when the caller passes no handler', async () => {
    // `onNotice` is optional; a missing one must not turn a survivable
    // retirement into a crash.
    mockState.working = MODEL_CANDIDATES.quality[1];
    await expect(
      translateBatch([{ text: 'Blue Shirt' }], opts(undefined)),
    ).resolves.toBeDefined();
  });
});

describe('a retirement is remembered per key, not globally', () => {
  /**
   * The API answers NOT_FOUND both for a genuinely retired id and for one the
   * project behind that key cannot use, and `isModelUnavailable` cannot tell
   * them apart. With one shared registry the second case poisoned the first:
   * key B's project lacks Pro, a 429 on key A rotates to B, B 404s, and Pro is
   * struck off for the whole session — so every later call runs on a weaker
   * model even once rotation puts key A back in front.
   */
  const originalLocalStorage = (globalThis as any).localStorage;
  let currentKey = '';

  beforeEach(() => {
    resetRetiredModels();
    currentKey = 'AIzaKEY-A';
    (globalThis as any).localStorage = {
      getItem: (k: string) => (k === 'gemini_api_key' ? currentKey : ''),
      setItem: () => {},
    };
  });

  afterEach(() => {
    (globalThis as any).localStorage = originalLocalStorage;
  });

  it('does not degrade a second key because the first could not use a model', () => {
    const preferred = resolveModel('quality');
    retireModel('quality', preferred);
    expect(resolveModel('quality')).not.toBe(preferred);

    currentKey = 'AIzaKEY-B';
    expect(resolveModel('quality')).toBe(preferred);
  });

  it('still remembers within one key, so the wasted request is paid once', () => {
    // The whole point of a registry: on a 500-row translation this is the
    // difference between one wasted request and one per batch.
    const preferred = resolveModel('quality');
    retireModel('quality', preferred);
    currentKey = 'AIzaKEY-B';
    resolveModel('quality');
    currentKey = 'AIzaKEY-A';
    expect(resolveModel('quality')).not.toBe(preferred);
  });

  it('keeps buckets separate for keys that share a prefix', () => {
    const preferred = resolveModel('fast');
    retireModel('fast', preferred);
    currentKey = 'AIzaKEY-A2';
    expect(resolveModel('fast')).toBe(preferred);
  });

  it('does not throw when no key is readable', () => {
    // The service is imported by the unit suite under `environment: 'node'`,
    // where `localStorage` does not exist at all.
    delete (globalThis as any).localStorage;
    expect(() => resolveModel('quality')).not.toThrow();
    expect(typeof resolveModel('quality')).toBe('string');
  });
});

describe('the two detectors stay disjoint', () => {
  it('never classifies the real 404 as a key issue', () => {
    // If both matched, the catch order would decide behaviour by accident.
    expect(isKeyIssue(new Error(REAL_404))).toBe(false);
  });

  it('never classifies a quota error as a model problem', () => {
    const quota = new Error('429 quota exceeded');
    expect(isKeyIssue(quota)).toBe(true);
    expect(isModelUnavailable(quota)).toBe(false);
  });
});

describe('modelUnavailableError', () => {
  it('names what was tried and points at the script that finds a replacement', () => {
    const err = modelUnavailableError('quality');
    expect(err.message).toContain('quality');
    expect(err.message).toContain('list-gemini-models.mjs');
    for (const m of MODEL_CANDIDATES.quality) expect(err.message).toContain(m);
    // The raw SDK blob is what users saw before; this must not be that.
    expect(err.message).not.toContain('"error"');
  });
});

describe('walking the candidate list', () => {
  beforeEach(resetRetiredModels);

  it('starts at the caller-preferred model for each tier', () => {
    expect(resolveModel('quality')).toBe(MODEL_CANDIDATES.quality[0]);
    expect(resolveModel('fast')).toBe(MODEL_CANDIDATES.fast[0]);
  });

  it('leads the quality tier with Gemini 3.1 Pro, as requested', () => {
    expect(MODEL_CANDIDATES.quality[0]).toBe('gemini-3.1-pro');
  });

  it('advances past a retired id', () => {
    const first = resolveModel('quality');
    const next = retireModel('quality', first);
    expect(next).not.toBe(first);
    expect(resolveModel('quality')).toBe(next);
  });

  it('remembers a retirement, so later calls do not re-try the dead id', () => {
    // The point of module-level state: on a 500-row translation this is the
    // difference between one wasted request and one per batch.
    const dead = resolveModel('quality');
    retireModel('quality', dead);
    expect(resolveModel('quality')).not.toBe(dead);
    expect(resolveModel('quality')).not.toBe(dead);
  });

  it('walks the whole list in order, then reports exhaustion', () => {
    const order: string[] = [];
    let m: string | null = resolveModel('quality');
    while (m) { order.push(m); m = retireModel('quality', m); }
    expect(order).toEqual([...MODEL_CANDIDATES.quality]);
  });

  it('never returns undefined once every candidate is retired', () => {
    // Callers put the result straight into an API call; `undefined` there is a
    // crash instead of a useful error.
    for (const m of MODEL_CANDIDATES.fast) retireModel('fast', m);
    expect(typeof resolveModel('fast')).toBe('string');
    expect(resolveModel('fast').length).toBeGreaterThan(0);
  });

  it('keeps tiers independent enough to degrade rather than die', () => {
    // Retiring every Pro id must still leave the quality tier a Flash id to use.
    for (const m of ['gemini-3.1-pro', 'gemini-3-pro', 'gemini-3-pro-preview']) {
      retireModel('quality', m);
    }
    expect(resolveModel('quality')).toMatch(/flash/);
  });

  it('has no duplicate ids in a tier, which would waste a request', () => {
    for (const tier of ['fast', 'quality'] as const) {
      const list = MODEL_CANDIDATES[tier];
      expect(new Set(list).size, `${tier} has duplicates`).toBe(list.length);
    }
  });
});
