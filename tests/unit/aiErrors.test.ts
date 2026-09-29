import { describe, it, expect, vi } from 'vitest';
import { classifyAiError, friendlyAiError, readableAiError, AI_ERROR_CATEGORIES } from '../../utils/aiErrors';
import { TRANSLATIONS } from '../../utils/translations';

/** The SDK's ApiError message: the HTTP body, JSON-encoded inside a JSON envelope. */
const sdkError = (code: number, body: object) =>
  new Error(JSON.stringify({ error: { message: JSON.stringify({ error: body }, null, 1), code, status: '' } }));

// The shapes seen in the live run of 2026-09-29, plus the service's own errors.
const CASES: [string, unknown, string][] = [
  ['missing key', new Error('API Key not found. Please configure in settings.'), 'no-key'],
  ['rejected key', sdkError(400, { code: 400, message: 'API key not valid. Please pass a valid API key.', status: 'INVALID_ARGUMENT' }), 'invalid-key'],
  ['forbidden', sdkError(403, { code: 403, message: 'Permission denied.', status: 'PERMISSION_DENIED' }), 'invalid-key'],
  ['no model (service kind)', Object.assign(new Error('x'), { aiKind: 'no-model' }), 'no-model'],
  ['no model (service message)', new Error('No usable Gemini model for the "quality" tier — every candidate was rejected as unavailable (a, b).'), 'no-model'],
  ['retired model', new Error('models/x is not found for API version v1beta. status: NOT_FOUND'), 'no-model'],
  ['all busy (service kind)', Object.assign(new Error('Every "quality" model is unavailable'), { aiKind: 'all-models-busy' }), 'busy'],
  ['overloaded', sdkError(503, { code: 503, message: 'This model is currently experiencing high demand.', status: 'UNAVAILABLE' }), 'busy'],
  ['rate limited', sdkError(429, { code: 429, message: 'You exceeded your current quota. limit: 15', status: 'RESOURCE_EXHAUSTED' }), 'quota'],
  ['bad JSON', new Error('AI returned invalid JSON.'), 'bad-output'],
  ['bad shape', new Error('AI output format unrecognized (not array or object).'), 'bad-output'],
  ['offline', new TypeError('Failed to fetch'), 'network'],
  ['anything else', new Error('boom'), 'unknown'],
  ['not even an Error', undefined, 'unknown'],
];

describe('classifyAiError', () => {
  it.each(CASES)('%s', (_, error, kind) => {
    expect(classifyAiError(error)).toBe(kind);
  });
});

describe('friendlyAiError', () => {
  it('every category has a message in English AND Arabic', () => {
    for (const kind of AI_ERROR_CATEGORIES) {
      expect(TRANSLATIONS.en.aiErrors[kind], `en ${kind}`).toMatch(/\w/);
      expect(TRANSLATIONS.ar.aiErrors[kind], `ar ${kind}`).toMatch(/[\u0600-\u06FF]/);
      expect(TRANSLATIONS.ar.aiErrors[kind]).not.toBe(TRANSLATIONS.en.aiErrors[kind]);
    }
  });

  it.each(CASES)('%s: no raw JSON, status codes or internals reach the user', (_, error) => {
    for (const lang of ['en', 'ar'] as const) {
      const text = friendlyAiError(error, lang);
      expect(text).toBe(TRANSLATIONS[lang].aiErrors[classifyAiError(error)]);
      expect(text).not.toMatch(/[{}"\\]/);
      // Status NAMES are upper-case in the raw error; "unavailable" in a sentence is fine.
      expect(text).not.toMatch(/RESOURCE_EXHAUSTED|INVALID_ARGUMENT|UNAVAILABLE|NOT_FOUND|PERMISSION_DENIED/);
      expect(text).not.toMatch(/\b(400|403|429|503)\b|gemini-|googleapis|stack/i);
    }
  });

  it('the live-run error becomes one readable sentence', () => {
    const live = sdkError(429, {
      code: 429,
      message: 'You exceeded your current quota. \n* Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_requests, limit: 0, model: gemini-3.1-pro',
      status: 'RESOURCE_EXHAUSTED',
    });
    expect(friendlyAiError(live, 'en')).toBe('The AI usage limit for this key has been reached. Wait a minute and try again, or use another key.');
    expect(friendlyAiError(live, 'ar')).toBe(TRANSLATIONS.ar.aiErrors.quota);
  });

  it('the per-item prefixes exist in both languages and take the file name', () => {
    for (const lang of ['en', 'ar'] as const) {
      expect(TRANSLATIONS[lang].aiErrors.fileFailed).toContain('{file}');
      expect(TRANSLATIONS[lang].aiErrors.textFailed).toBeTruthy();
    }
  });
});

describe('readableAiError — for tabs whose catch also reports their own errors (TD-051)', () => {
  const raw = sdkError(503, { code: 503, message: 'This model is currently experiencing high demand.', status: 'UNAVAILABLE' });

  it('returns an Error carrying ONLY the localised sentence, plus its category', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const en = readableAiError(raw, 'en', 'Web Scraper');
    const ar = readableAiError(raw, 'ar', 'Web Scraper');
    expect(en).toBeInstanceOf(Error);
    expect(en.message).toBe(TRANSLATIONS.en.aiErrors.busy);
    expect(ar.message).toBe(TRANSLATIONS.ar.aiErrors.busy);
    expect(en.aiCategory).toBe('busy');
    expect(en.message).not.toMatch(/[{}"]|UNAVAILABLE|503/);
    spy.mockRestore();
  });

  it('keeps the RAW error for debugging, in the console, tagged with the tool', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    readableAiError(raw, 'en', 'Translator');
    expect(spy).toHaveBeenCalledWith('[Translator] AI request failed:', raw);
    spy.mockRestore();
  });

  it('the fallback sentence names no single tool — it is shown by all of them', () => {
    for (const lang of ['en', 'ar'] as const) {
      expect(TRANSLATIONS[lang].aiErrors.unknown).not.toMatch(/extract|استخراج|translat|ترجم/i);
    }
  });
});
