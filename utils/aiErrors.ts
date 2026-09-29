/**
 * Readable AI failures. A provider error reaches the UI as its raw message —
 * for Gemini, the HTTP body as JSON inside a JSON envelope — which told users
 * nothing and showed them internal detail. The UI shows one short, localised
 * sentence per KIND of failure instead; the raw error goes to the console.
 *
 * The classification reads the message text only, so it works for every
 * provider behind aiServiceFactory, not just Gemini.
 */
import { TRANSLATIONS, Language } from './translations';

export type AiErrorCategory =
  | 'no-key' | 'invalid-key' | 'no-model' | 'busy' | 'quota' | 'bad-output' | 'network' | 'unknown';

export const AI_ERROR_CATEGORIES: readonly AiErrorCategory[] =
  ['no-key', 'invalid-key', 'no-model', 'busy', 'quota', 'bad-output', 'network', 'unknown'];

export const classifyAiError = (error: unknown): AiErrorCategory => {
  // Errors geminiService raised itself carry their kind; trust that first.
  const aiKind = (error as { aiKind?: unknown } | null)?.aiKind;
  if (aiKind === 'no-model') return 'no-model';
  if (aiKind === 'all-models-busy') return 'busy';

  const msg = String((error as { message?: unknown } | null)?.message ?? error ?? '').toLowerCase();
  if (msg.includes('api key not found')) return 'no-key';
  if (msg.includes('invalid json') || msg.includes('format unrecognized')) return 'bad-output';
  if (msg.includes('api key not valid') || msg.includes('api_key_invalid') || msg.includes('permission_denied')
      || msg.includes('unauthenticated') || /\b(401|403)\b/.test(msg)) return 'invalid-key';
  if (msg.includes('no usable gemini model') || msg.includes('no longer available') || msg.includes('not_found')
      || msg.includes('is not found') || (/\b404\b/.test(msg) && msg.includes('model'))) return 'no-model';
  if (/\b503\b/.test(msg) || msg.includes('high demand') || msg.includes('overloaded') || msg.includes('unavailable')) return 'busy';
  if (/\b429\b/.test(msg) || msg.includes('resource_exhausted') || msg.includes('quota') || msg.includes('rate limit')) return 'quota';
  if (msg.includes('failed to fetch') || msg.includes('networkerror') || msg.includes('network error')
      || msg.includes('load failed') || msg.includes('timeout') || msg.includes('timed out')
      || msg.includes('econnreset') || msg.includes('enotfound')) return 'network';
  return 'unknown';
};

/** The one sentence the user sees for this error. Never contains the raw message. */
export const friendlyAiError = (error: unknown, language: Language = 'en'): string =>
  (TRANSLATIONS[language] ?? TRANSLATIONS.en).aiErrors[classifyAiError(error)];

/**
 * For a tab whose catch also handles its OWN errors (a failed page fetch, an
 * unreadable file): convert only the AI call's error, at the call, and let the
 * tab's existing message wrap it. The raw provider error goes to the console
 * here, so no caller can forget to keep it for debugging.
 *
 *   try { result = await aiService.x(...) }
 *   catch (e) { throw readableAiError(e, language, 'Web Scraper') }
 */
export const readableAiError = (
  error: unknown,
  language: Language = 'en',
  context = 'AI call',
): Error & { aiCategory: AiErrorCategory } => {
  console.error(`[${context}] AI request failed:`, error);
  return Object.assign(new Error(friendlyAiError(error, language)), { aiCategory: classifyAiError(error) });
};
