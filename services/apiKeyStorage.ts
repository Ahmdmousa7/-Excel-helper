/**
 * API key storage — pure localStorage access, no SDK.
 *
 * Split out of geminiService.ts for code splitting (TD-004). App.tsx needs
 * these four functions on first paint to decide whether to open the key modal,
 * but geminiService statically imports `@google/genai` (~52 KB gzipped), so
 * importing them from there dragged the whole AI SDK into the entry chunk for
 * what amounts to two localStorage reads.
 *
 * Nothing here imports anything. Keep it that way — the value of this module is
 * that it is free to import from anywhere.
 */

const GEMINI_KEY_STORAGE = 'gemini_api_key';
const GROQ_KEY_STORAGE = 'groq_api_key';

export const getStoredApiKeys = (): { gemini: string; groq: string } => ({
  gemini: localStorage.getItem(GEMINI_KEY_STORAGE) || '',
  groq: localStorage.getItem(GROQ_KEY_STORAGE) || '',
});

export const setStoredApiKeys = (gemini: string, groq: string): void => {
  localStorage.setItem(GEMINI_KEY_STORAGE, gemini);
  localStorage.setItem(GROQ_KEY_STORAGE, groq);
};

/**
 * The first key from a newline-separated list, for callers that rotate keys.
 */
export const getStoredApiKey = (): string => {
  const keys = getStoredApiKeys()
    .gemini.split('\n')
    .map((k) => k.trim())
    .filter(Boolean);
  return keys[0] ?? '';
};
