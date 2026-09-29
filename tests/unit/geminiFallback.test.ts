import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/**
 * Model fallback for OCR, driven by the EXACT error shapes Google returned in
 * the live run of 2026-09-29 against a free-tier key:
 *
 *   - 429 RESOURCE_EXHAUSTED with `limit: 0` for gemini-3.1-pro — the free tier
 *     has no quota for that model at all. Not a rate limit: waiting never helps.
 *   - 503 UNAVAILABLE, "This model is currently experiencing high demand" — the
 *     model is overloaded right now, for everyone.
 *
 * Before the fix both were retried ON THE SAME MODEL until the retry budget ran
 * out: four 429s over ~3 minutes, never reaching the Flash models that sit
 * further down the very same candidate list.
 */

type Behaviour = 'ok' | 'no-quota' | 'overloaded' | 'rate-limited' | 'retired' | 'bad-key';

const state = vi.hoisted(() => ({
  tried: [] as string[],
  /** `key:model` for every request — the key is the one the client was built with. */
  triedWithKey: [] as string[],
  behaviour: {} as Record<string, string>,
  /** Per-key overrides: keyBehaviour[key][model] wins over behaviour[model]. */
  keyBehaviour: {} as Record<string, Record<string, string>>,
  /** For 'rate-limited': fail this many times, then succeed. */
  rateLimitedRemaining: 0,
}));

/** The SDK's ApiError message: the HTTP body, JSON-encoded inside a JSON envelope. */
const sdkError = (code: number, body: object) =>
  new Error(JSON.stringify({ error: { message: JSON.stringify({ error: body }, null, 1), code, status: '' } }));

const NO_QUOTA = (model: string) => sdkError(429, {
  code: 429,
  message: `You exceeded your current quota, please check your plan and billing details. \n* Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_requests, limit: 0, model: ${model}\nPlease retry in 17.3s.`,
  status: 'RESOURCE_EXHAUSTED',
});
const RATE_LIMITED = (model: string) => sdkError(429, {
  code: 429,
  message: `You exceeded your current quota. \n* Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_requests, limit: 15, model: ${model}\nPlease retry in 4s.`,
  status: 'RESOURCE_EXHAUSTED',
});
const OVERLOADED = () => sdkError(503, {
  code: 503,
  message: 'This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again later.',
  status: 'UNAVAILABLE',
});
const BAD_KEY = () => sdkError(400, { code: 400, message: 'API key not valid. Please pass a valid API key.', status: 'INVALID_ARGUMENT' });
const RETIRED = () => new Error('models/x is not found for API version v1beta. status: NOT_FOUND');

function fail(model: string, apiKey = ''): void {
  state.tried.push(model);
  state.triedWithKey.push(`${apiKey}:${model}`);
  const b = state.keyBehaviour[apiKey]?.[model] ?? state.behaviour[model] ?? 'ok';
  if (b === 'no-quota') throw NO_QUOTA(model);
  if (b === 'overloaded') throw OVERLOADED();
  if (b === 'retired') throw RETIRED();
  if (b === 'bad-key') throw BAD_KEY();
  if (b === 'rate-limited' && state.rateLimitedRemaining > 0) {
    state.rateLimitedRemaining--;
    throw RATE_LIMITED(model);
  }
}

vi.mock('@google/genai', () => ({
  GoogleGenAI: class {
    apiKey: string;
    constructor(opts: { apiKey: string }) { this.apiKey = opts?.apiKey ?? ''; }
    models = {
      generateContent: async ({ model }: { model: string }) => {
        fail(model, this.apiKey);
        return { text: `[{"Product Name":"from ${model}"}]` };
      },
      generateContentStream: async ({ model }: { model: string }) => {
        fail(model, this.apiKey);
        return (async function* () { yield { text: `[{"Product Name":"from ${model}"}]` }; })();
      },
    };
  },
  Type: {},
}));

import {
  MODEL_CANDIDATES, resolveModel, resetRetiredModels,
  extractFromMedia, extractStructuredData, classifyModelFailure,
  translateBatch, processGeneralFile, generateText,
} from '../../services/geminiService';

const Q = MODEL_CANDIDATES.quality;
const PROS = Q.filter((m) => m.includes('pro'));
const FLASHES = Q.filter((m) => m.includes('flash'));
const IMAGE = { data: 'AAAA', mimeType: 'image/jpeg' };

/** The stored key value: ONE key, or several separated by newlines (rotation). */
let storedKey = 'AIzaKEY-A';
const originalLocalStorage = (globalThis as any).localStorage;

beforeEach(() => {
  state.tried.length = 0;
  state.triedWithKey.length = 0;
  state.behaviour = {};
  state.keyBehaviour = {};
  state.rateLimitedRemaining = 0;
  storedKey = 'AIzaKEY-A';
  resetRetiredModels();
  (globalThis as any).localStorage = {
    getItem: (k: string) => (k === 'gemini_api_key' ? storedKey : ''),
    // Stateful, so rotateKey() really moves to the next key.
    setItem: (k: string, v: string) => { if (k === 'gemini_api_key') storedKey = v; },
  };
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  (globalThis as any).localStorage = originalLocalStorage;
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('the candidate list is what the tests assume', () => {
  it('quality tier: Pro models first, Flash models after', () => {
    // If this changes, re-read the tests below: they rely on the order.
    expect(PROS.length).toBeGreaterThan(0);
    expect(FLASHES.length).toBeGreaterThan(0);
    expect(Q.indexOf(FLASHES[0])).toBeGreaterThan(Q.indexOf(PROS[PROS.length - 1]));
  });
});

describe('classifyModelFailure — on the real error shapes', () => {
  it('a 429 with `limit: 0` means this key has NO quota for the model', () => {
    expect(classifyModelFailure(NO_QUOTA('gemini-3.1-pro'))).toBe('no-quota');
  });
  it('a 429 with a non-zero limit is a genuine, temporary rate limit', () => {
    expect(classifyModelFailure(RATE_LIMITED('gemini-3.1-pro'))).toBe('transient');
  });
  it('a 503 "high demand" means the model is overloaded', () => {
    expect(classifyModelFailure(OVERLOADED())).toBe('overloaded');
  });
  it('NOT_FOUND means the model is retired', () => {
    expect(classifyModelFailure(RETIRED())).toBe('retired');
  });
  it('an invalid key is NOT a model problem — switching models would not help', () => {
    expect(classifyModelFailure(BAD_KEY())).toBe('transient');
  });
  it('`limit: 0.5` or `limit: 05` is not read as zero', () => {
    expect(classifyModelFailure(new Error('429 quota exceeded, limit: 0.5'))).not.toBe('no-quota');
  });
});

describe('extractFromMedia (image OCR) — the live-run failure', () => {
  it('REPRODUCTION: every Pro has no quota → it moves on to Flash and succeeds', async () => {
    for (const m of PROS) state.behaviour[m] = 'no-quota';
    const out = await extractFromMedia(IMAGE, 'menu');
    expect(out).toEqual([{ 'Product Name': `from ${FLASHES[0]}` }]);
    // Each Pro tried ONCE — none consumed the retry budget — then the first Flash.
    expect(state.tried).toEqual([...PROS, FLASHES[0]]);
  });

  it('no-quota is remembered PER KEY: the next call on the same key skips Pro', async () => {
    for (const m of PROS) state.behaviour[m] = 'no-quota';
    await extractFromMedia(IMAGE, 'menu');
    expect(resolveModel('quality')).toBe(FLASHES[0]);
    storedKey = 'AIzaKEY-B'; // a different key's project may well have Pro quota
    expect(resolveModel('quality')).toBe(PROS[0]);
  });

  it('an overloaded model is skipped for THIS call, but not retired', async () => {
    for (const m of PROS) state.behaviour[m] = 'no-quota';
    state.behaviour[FLASHES[0]] = 'overloaded';
    const out = await extractFromMedia(IMAGE, 'menu');
    expect(out[0]['Product Name']).toBe(`from ${FLASHES[1]}`);
    expect(state.tried.filter((m) => m === FLASHES[0])).toHaveLength(1); // not hammered
    // Overload is temporary and global: the next call tries FLASHES[0] again.
    expect(resolveModel('quality')).toBe(FLASHES[0]);
  });

  it('when EVERY candidate is unusable it stops after one request each, with a readable error', async () => {
    for (const m of PROS) state.behaviour[m] = 'no-quota';
    for (const m of FLASHES) state.behaviour[m] = 'overloaded';
    const err = await extractFromMedia(IMAGE, 'menu').then(() => null, (e) => e);
    expect(err).toBeInstanceOf(Error);
    expect(err.aiKind).toBe('all-models-busy');
    expect(state.tried).toEqual([...Q]); // exactly one request per candidate, no retry storm
  });

  it('D11 / LIVE RUN: Pros no-quota, both Flash ids overloaded → the verified last resort answers', async () => {
    // The exact state of 2026-09-29: the only model that answered the real
    // image request was gemini-3-flash-preview, now the LAST quality candidate.
    expect(Q[Q.length - 1]).toBe('gemini-3-flash-preview');
    for (const m of PROS) state.behaviour[m] = 'no-quota';
    state.behaviour['gemini-3.6-flash'] = 'overloaded';
    state.behaviour['gemini-flash-latest'] = 'overloaded';
    const out = await extractFromMedia(IMAGE, 'menu');
    expect(out).toEqual([{ 'Product Name': 'from gemini-3-flash-preview' }]);
    expect(state.tried).toEqual([...Q]); // one request each, in order, no retries
  });

  it('announces each switch on onNotice, naming both models', async () => {
    for (const m of PROS) state.behaviour[m] = 'no-quota';
    const notices: string[] = [];
    await extractFromMedia(IMAGE, 'menu', undefined, (n) => notices.push(n));
    expect(notices).toHaveLength(PROS.length);
    expect(notices[0]).toContain(PROS[0]);
    expect(notices[notices.length - 1]).toContain(FLASHES[0]);
  });

  it('a GENUINE rate limit keeps the existing retry-with-backoff on the same model', async () => {
    vi.useFakeTimers();
    state.behaviour[PROS[0]] = 'rate-limited';
    state.rateLimitedRemaining = 1;
    const pending = extractFromMedia(IMAGE, 'menu');
    await vi.advanceTimersByTimeAsync(61_000);
    const out = await pending;
    expect(out[0]['Product Name']).toBe(`from ${PROS[0]}`);
    expect(state.tried).toEqual([PROS[0], PROS[0]]); // retried, not switched
  });

  it('an invalid key does not walk the model list', async () => {
    vi.useFakeTimers();
    for (const m of Q) state.behaviour[m] = 'bad-key';
    const pending = extractFromMedia(IMAGE, 'menu').then(() => null, (e) => e);
    await vi.advanceTimersByTimeAsync(10 * 61_000);
    const err = await pending;
    expect(err).toBeInstanceOf(Error);
    expect(new Set(state.tried)).toEqual(new Set([PROS[0]])); // only ever the first model
  });
});

describe('extractStructuredData (spreadsheet / Word / pasted text OCR)', () => {
  it('moves past a model with no quota instead of retrying it', async () => {
    const F = MODEL_CANDIDATES.fast;
    state.behaviour[F[0]] = 'no-quota';
    const out = await extractStructuredData('Tea 13', 'menu');
    expect(out).toEqual([{ 'Product Name': `from ${F[1]}` }]);
    expect(state.tried).toEqual([F[0], F[1]]);
  });

  it('moves past an overloaded model within the same call', async () => {
    const F = MODEL_CANDIDATES.fast;
    state.behaviour[F[0]] = 'overloaded';
    const out = await extractStructuredData('Tea 13', 'menu');
    expect(out[0]['Product Name']).toBe(`from ${F[1]}`);
    expect(resolveModel('fast')).toBe(F[0]); // not retired
  });
});

// --- TD-051: the same fallback for every other AI tool ----------------------

const TRANSLATE_OPTS = { sourceLang: 'ar', targetLang: 'en', domain: 'retail', glossary: [] as string[] };

describe('translateBatch (Translator) — TD-051', () => {
  it('REPRODUCTION: every Pro has no quota → moves on to Flash after one request each', async () => {
    for (const m of PROS) state.behaviour[m] = 'no-quota';
    const out = await translateBatch([{ text: 'شاي' }], TRANSLATE_OPTS);
    expect(out).toEqual([{ 'Product Name': `from ${FLASHES[0]}` }]);
    expect(state.tried).toEqual([...PROS, FLASHES[0]]);
  });

  it('an overloaded model is skipped for the call, not retired', async () => {
    state.behaviour[PROS[0]] = 'overloaded';
    await translateBatch([{ text: 'شاي' }], TRANSLATE_OPTS);
    expect(state.tried).toEqual([PROS[0], PROS[1]]);
    expect(resolveModel('quality')).toBe(PROS[0]);
  });

  it('every candidate unusable → a classified error after one request each', async () => {
    for (const m of Q) state.behaviour[m] = 'no-quota';
    const err = await translateBatch([{ text: 'x' }], TRANSLATE_OPTS).then(() => null, (e) => e);
    expect(err.aiKind).toBe('no-model');
    expect(state.tried).toEqual([...Q]);
  });

  it('announces the switch on onNotice', async () => {
    state.behaviour[PROS[0]] = 'no-quota';
    const notices: string[] = [];
    await translateBatch([{ text: 'x' }], { ...TRANSLATE_OPTS, onNotice: (n) => notices.push(n) });
    expect(notices).toHaveLength(1);
    expect(notices[0]).toMatch(/no quota on this API key.*quality may differ/i);
  });

  it('a GENUINE rate limit still retries the same model', async () => {
    vi.useFakeTimers();
    state.behaviour[PROS[0]] = 'rate-limited';
    state.rateLimitedRemaining = 1;
    const pending = translateBatch([{ text: 'x' }], TRANSLATE_OPTS);
    await vi.advanceTimersByTimeAsync(61_000);
    await pending;
    expect(state.tried).toEqual([PROS[0], PROS[0]]);
  });
});

describe('processGeneralFile (Compare AI analysis) — TD-051', () => {
  it('moves past no-quota and overloaded models instead of failing on the first', async () => {
    state.behaviour[PROS[0]] = 'no-quota';
    state.behaviour[PROS[1]] = 'overloaded';
    const out = await processGeneralFile({ text: 'a,b' }, 'summarise');
    expect(out).toBe(`[{"Product Name":"from ${PROS[2]}"}]`);
    expect(state.tried).toEqual([PROS[0], PROS[1], PROS[2]]);
  });

  it('other errors still propagate at once (no retry loop was ever here)', async () => {
    state.behaviour[PROS[0]] = 'bad-key';
    await expect(processGeneralFile({ text: 'a' }, 'x')).rejects.toThrow(/API key not valid/);
    expect(state.tried).toEqual([PROS[0]]);
  });
});

describe('generateText (Support Chat) — TD-051', () => {
  it('moves past no-quota and overloaded models (fast tier)', async () => {
    const F = MODEL_CANDIDATES.fast;
    state.behaviour[F[0]] = 'overloaded';
    state.behaviour[F[1]] = 'no-quota';
    const out = await generateText('hello');
    expect(out).toBe(`[{"Product Name":"from ${F[2]}"}]`);
    expect(state.tried).toEqual([F[0], F[1], F[2]]);
  });

  it('every candidate unusable → a classified "busy" error, one request each', async () => {
    const F = MODEL_CANDIDATES.fast;
    for (const m of F) state.behaviour[m] = 'overloaded';
    const err = await generateText('hello').then(() => null, (e) => e);
    expect(err.aiKind).toBe('all-models-busy');
    expect(state.tried).toEqual([...F]);
  });
});

// --- Review finding (TD-051): no-quota must try the NEXT KEY before a worse model

describe('no quota on this key → the next API key first, a worse model only when no key can', () => {
  const KEYS = ['AIzaKEY-A', 'AIzaKEY-B'].join(String.fromCharCode(10)); // one key per line

  it('key A has no Pro quota, key B does → stays on Pro, on key B', async () => {
    storedKey = KEYS;
    state.keyBehaviour['AIzaKEY-A'] = { [PROS[0]]: 'no-quota' };
    const notices: string[] = [];
    const out = await extractFromMedia(IMAGE, 'menu', undefined, (n) => notices.push(n));
    expect(out).toEqual([{ 'Product Name': `from ${PROS[0]}` }]);
    expect(state.triedWithKey).toEqual([`AIzaKEY-A:${PROS[0]}`, `AIzaKEY-B:${PROS[0]}`]);
    expect(notices).toHaveLength(1);
    expect(notices[0]).toMatch(/no quota on this API key; trying the next API key/i);
    expect(notices[0]).not.toMatch(/quality may differ/i); // same model: no downgrade
    expect(notices.join(' ')).not.toContain('AIzaKEY'); // never a credential in a notice
  });

  it('NO key has quota for the model → only then the next model, one request per key', async () => {
    storedKey = KEYS;
    state.behaviour[PROS[0]] = 'no-quota';
    const out = await extractFromMedia(IMAGE, 'menu');
    expect(out).toEqual([{ 'Product Name': `from ${PROS[1]}` }]);
    expect(state.triedWithKey.slice(0, 2)).toEqual([`AIzaKEY-A:${PROS[0]}`, `AIzaKEY-B:${PROS[0]}`]);
    expect(state.tried).toEqual([PROS[0], PROS[0], PROS[1]]);
  });

  it('every model on every key has no quota → stops with "no-model" after one request per key and model', async () => {
    storedKey = KEYS;
    for (const m of Q) state.behaviour[m] = 'no-quota';
    const err = await extractFromMedia(IMAGE, 'menu').then(() => null, (e) => e);
    expect(err.aiKind).toBe('no-model');
    expect(state.triedWithKey).toHaveLength(Q.length * 2);
    expect(new Set(state.triedWithKey).size).toBe(Q.length * 2); // nothing asked twice
  });

  it('an OVERLOADED model does not rotate keys — overload is the model, not the key', async () => {
    storedKey = KEYS;
    state.behaviour[PROS[0]] = 'overloaded';
    await extractFromMedia(IMAGE, 'menu');
    expect(state.triedWithKey).toEqual([`AIzaKEY-A:${PROS[0]}`, `AIzaKEY-A:${PROS[1]}`]);
  });

  it('the same rule in the other AI calls: translateBatch, processGeneralFile, generateText', async () => {
    for (const run of [
      () => translateBatch([{ text: 'x' }], TRANSLATE_OPTS),
      () => processGeneralFile({ text: 'a' }, 'x'),
      () => generateText('hi', 'quality'),
    ]) {
      storedKey = KEYS;
      resetRetiredModels();
      state.triedWithKey.length = 0;
      state.keyBehaviour = { 'AIzaKEY-A': { [PROS[0]]: 'no-quota' } };
      await run();
      expect(state.triedWithKey).toEqual([`AIzaKEY-A:${PROS[0]}`, `AIzaKEY-B:${PROS[0]}`]);
    }
  });

  it('with ONE key nothing changes: straight to the next model', async () => {
    state.behaviour[PROS[0]] = 'no-quota';
    await extractFromMedia(IMAGE, 'menu');
    expect(state.triedWithKey).toEqual([`AIzaKEY-A:${PROS[0]}`, `AIzaKEY-A:${PROS[1]}`]);
  });
});
