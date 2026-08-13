import { describe, it, expect } from 'vitest';
import {
  GEMINI_FLASH,
  GEMINI_PRO,
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
  it('names the model and points at the script that finds a replacement', () => {
    const err = modelUnavailableError('gemini-3-pro-preview');
    expect(err.message).toContain('gemini-3-pro-preview');
    expect(err.message).toContain('list-gemini-models.mjs');
    // The raw SDK blob is what users saw before; this must not be that.
    expect(err.message).not.toContain('{');
  });
});

describe('the pinned model ids', () => {
  it('are distinct, so the fallback actually changes model', () => {
    // otherModel() swaps between exactly these two. If they were ever set to the
    // same id the fallback would silently retry the dead model.
    expect(GEMINI_FLASH).not.toBe(GEMINI_PRO);
  });
});
