import { describe, it, expect, beforeEach } from 'vitest';
import {
  MODEL_CANDIDATES,
  resolveModel,
  retireModel,
  resetRetiredModels,
  isModelUnavailable,
  isKeyIssue,
  modelUnavailableError,
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
