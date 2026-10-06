
import { GoogleGenAI, Schema, Type } from "@google/genai";
// `ModelNotice` is imported, not redeclared here: it is part of the provider
// contract in `IAiService`, and a second local copy would let this file and the
// interface drift — which is the same mistake as the three separate copies of
// `translateBatch`'s options shape.
import { AiTier, ApiKeyStatus, IAiService, ModelNotice } from "../types/ai.types";

/**
 * Model ids per tier, in preference order.
 *
 * A LIST, not a constant, because pinning one id is what caused the outage this
 * replaced: `gemini-3-pro-preview` was retired and every Pro feature returned
 * 404 at the moment a user clicked a button. Google ships these as *preview*
 * releases and retires them on its own schedule, so "the id is currently
 * correct" is a fact with an expiry date.
 *
 * The service walks its tier's list and uses the first id that answers. An id
 * that comes back "no longer available" is struck off for the session and the
 * next one is tried, so a retirement costs one wasted request rather than a
 * broken feature. `resolveModel()` picks the id; `advanceModel()` moves past one
 * that is retired, has no quota on the key, or is overloaded.
 *
 * Ordering is the only judgement here:
 *   quality — newest Pro first, older Pro ids behind it, Flash last so the tier
 *             degrades in quality rather than failing outright.
 *   fast    — Flash ids first, ending on a Pro id because it beats nothing.
 *
 * EVERY ID BELOW IS VERIFIED AGAINST A REAL KEY, on 2026-08-13, with
 * `GEMINI_API_KEY=… node scripts/list-gemini-models.mjs`. That is the only way to
 * know; run it again rather than inferring, and via the env var rather than as an
 * argument — the script explains why.
 *
 * The previous list was written from judgement and was almost entirely wrong.
 * `gemini-3.1-pro`, `gemini-3-pro`, `gemini-3-pro-preview`, `gemini-3.1-flash`
 * and `gemini-3-flash` do not exist on this key; only `gemini-3-flash-preview`
 * did. So BOTH tiers resolved to the same Flash-preview id, and the 'quality'
 * tier — Translate, Web Scraper, Compare, OCR-on-images — had been running on
 * Flash while claiming Pro, at a cost of five wasted 404s per session per tier
 * to discover it. The fallback machinery worked exactly as designed; what it was
 * falling back FROM was fiction.
 *
 * Two notes on the ids that are here:
 *   - `gemini-3.1-pro-preview` is what "Gemini 3.1 Pro" actually is on this key.
 *     There is no non-preview `gemini-3.1-pro`.
 *   - `gemini-pro-latest` / `gemini-flash-latest` are moving aliases Google
 *     maintains, so they cannot be retired out from under us. Each tier carries
 *     one as a permanent backstop — the thing this file lacked.
 *
 *     There is no tidy rule for where they sit, and two earlier versions of this
 *     comment invented one that the lists did not follow. What the order actually
 *     reflects is EXPECTED RECENCY: `gemini-pro-latest` is ahead of
 *     `gemini-2.5-pro` because the alias almost certainly points at something
 *     newer than 2.5, and `gemini-flash-latest` is ahead of
 *     `gemini-3-flash-preview` because a dated preview is the more fragile of the
 *     two. Where an explicit id is known to be newest — `gemini-3.1-pro-preview`,
 *     `gemini-3.6-flash` — it leads, because a pinned id is predictable and an
 *     alias can move under you between two runs with no commit to point at.
 *
 * This is the ONLY place model ids live. `components/SupportChat.tsx` used to
 * hold its own literal and call the SDK directly, which is why it was the single
 * feature with no fallback when an id was retired; it goes through
 * `generateText()` now. `grep -rn "gemini-" components/` should stay empty.
 */
export const MODEL_CANDIDATES: Record<AiTier, readonly string[]> = {
  quality: [
    'gemini-3.1-pro-preview',
    'gemini-pro-latest',
    'gemini-2.5-pro',
    // Degrade to Flash rather than fail: a weaker translation of the remaining
    // rows beats losing a 500-row run.
    'gemini-3.6-flash',
    'gemini-flash-latest',
    // Last resort for image OCR (D11). Verified on the real key on 2026-09-29:
    // it answered the live `ocr.jpg` image request with HTTP 200 when every Pro
    // had no quota and both Flash ids above were overloaded — the one model that
    // worked. Already verified for the fast tier on 2026-08-13.
    'gemini-3-flash-preview',
  ],
  fast: [
    'gemini-3.6-flash',
    'gemini-3.5-flash',
    'gemini-flash-latest',
    'gemini-3-flash-preview',
    'gemini-pro-latest',
  ],
};

/**
 * Ids proven gone this session, **per key**.
 *
 * Module-level, so one 404 teaches every later call instead of each one
 * rediscovering it — the difference between one wasted request and one per batch
 * on a 500-row translation.
 *
 * Keyed by key, though, because "this model is gone" is not a global fact. The
 * API answers NOT_FOUND both for a genuinely retired id and for one the *project
 * behind that key* cannot use, and `isModelUnavailable()` cannot tell those
 * apart. The app supports several keys (`rotateKey()` reorders them, and
 * TranslateTab tells users to add more so rate limits rotate rather than stop),
 * so a single shared Set produced this: key B's project lacks `gemini-3.1-pro`,
 * a 429 on key A rotates to B, B's next call 404s — and Pro is struck off for
 * the rest of the session, downgrading every later Translate/OCR/Compare call
 * even once rotation puts key A back in front.
 *
 * This is the same premise `verifyGeminiKey` already acted on when it refused to
 * record on behalf of the key being tested. That function was right and these
 * paths were wrong; both now agree that availability is per key and per project.
 *
 * Not persisted: a retirement is permanent but a transient 404 is not, and a bad
 * entry in localStorage would outlive the problem with no way for a user to
 * clear it. A page reload re-checks.
 */
const retiredModels = new Map<string, Set<string>>();

/**
 * A stable, non-reversible label for the key in use, so the registry can be
 * partitioned without holding raw keys in a structure that might get logged.
 * djb2 — this identifies, it does not protect anything.
 *
 * Falls back to a shared bucket when no key is readable (no `localStorage` under
 * the unit suite's `node` environment), which keeps the tier-walking logic
 * testable without a storage stub.
 */
const keyBucket = (): string => {
  let key = '';
  try {
    key = getStoredApiKey();
  } catch {
    key = '';
  }
  let h = 5381;
  for (let i = 0; i < key.length; i++) h = ((h << 5) + h + key.charCodeAt(i)) | 0;
  return `k${(h >>> 0).toString(36)}`;
};

const retiredFor = (bucket: string): Set<string> => {
  const existing = retiredModels.get(bucket);
  if (existing) return existing;
  const fresh = new Set<string>();
  retiredModels.set(bucket, fresh);
  return fresh;
};

/** The first id for this tier that has not been struck off for the current key. */
export const resolveModel = (tier: AiTier): string => {
  const retired = retiredFor(keyBucket());
  const alive = MODEL_CANDIDATES[tier].filter((m) => !retired.has(m));
  // Every candidate retired: hand back the first anyway so the caller produces a
  // real API error naming a real id, rather than crashing on `undefined`.
  return alive[0] ?? MODEL_CANDIDATES[tier][0];
};

/**
 * Strike an id off for the current key, for this session. Returns the next one
 * to try, or null.
 *
 * No production caller since TD-051: every AI call now goes through
 * `advanceModel`, which also handles no-quota and overload. Kept, and exported,
 * as the registry's direct handle — `tests/unit/geminiModels.test.ts` uses it to
 * seed per-key retirements and pin how `resolveModel` reads them.
 */
export const retireModel = (tier: AiTier, model: string): string | null => {
  const retired = retiredFor(keyBucket());
  retired.add(model);
  const next = MODEL_CANDIDATES[tier].find((m) => !retired.has(m));
  return next ?? null;
};

/** Test seam: forget everything struck off, for every key. */
export const resetRetiredModels = (): void => retiredModels.clear();

// Key Management
const GEMINI_KEY_STORAGE = 'gemini_api_key';

export const getStoredApiKeys = () => {
  return {
    gemini: localStorage.getItem(GEMINI_KEY_STORAGE) || ''
  };
};

export const setStoredApiKeys = (gemini: string) => {
  localStorage.setItem(GEMINI_KEY_STORAGE, gemini);
};

export const getStoredApiKey = () => {
    const keys = getStoredApiKeys();
    // primitive rotation if multiple lines?
    const geminiKeys = keys.gemini.split('\n').map(k => k.trim()).filter(k => k);
    if (geminiKeys.length > 0) return geminiKeys[0];
    return '';
}

// Internal Helper
const getAiClient = () => {
  const apiKey = getStoredApiKey();
  if (!apiKey) throw new Error("API Key not found. Please configure in settings.");
  return new GoogleGenAI({ apiKey });
};

export const verifyGeminiKey = async (
    keysString: string,
): Promise<Exclude<ApiKeyStatus, 'idle'>> => {
    const keys = keysString.split('\n').map(k => k.trim()).filter(k => k);
    if (keys.length === 0) return 'invalid';
    
    const keyToTest = keys[0];
    const ai = new GoogleGenAI({ apiKey: keyToTest });

    // Walks its OWN copy of the candidate list, and never calls `retireModel`.
    //
    // It has to walk: `retiredModels` starts empty on every page load and Test is
    // usually the FIRST call a user makes, so resolving alone would hand it the
    // retired id nobody had struck off yet and report a perfectly good key as
    // "invalid" — the worst answer a diagnostic can give, since it sends the user
    // to rotate a key that was never the problem.
    //
    // It must not RECORD, though: the registry is shared by every feature, while
    // model availability is per key and per project — and the key under test is
    // whatever was typed into the modal, not necessarily the one the app uses.
    // Striking an id off on its behalf would let testing one key disable a model
    // for another.
    for (const candidate of MODEL_CANDIDATES.fast) {
        try {
            await ai.models.generateContent({
                model: candidate,
                contents: { parts: [{ text: "test" }] }
            });
            return 'valid';
        } catch (e: any) {
            if (isModelUnavailable(e)) {
                console.warn(`Model "${candidate}" unavailable for this key; trying the next.`);
                continue;
            }
            if (e.message?.includes('429') || e.message?.includes('quota')) return 'quota';
            return 'invalid';
        }
    }

    // Every candidate rejected on a key that answered: a broken app, not a broken
    // key. This used to return 'invalid', which is the worst answer a diagnostic
    // can give — it sends the user to rotate a credential that was never the
    // problem, while the actual fault is a stale `MODEL_CANDIDATES` in this file.
    //
    // Not hypothetical: on 2026-08-13 five of the six 'quality' ids turned out
    // not to exist, so this branch was one retirement away from telling a user
    // with a perfectly good key that it was invalid.
    return 'no-model';
};

/**
 * "That model id does not exist any more" — a different failure from a bad key
 * or a quota, and it needs a different response.
 *
 * Google ships these ids as *preview* releases and retires them. When one goes,
 * every call using it returns 404 and the user sees a raw JSON blob at the moment
 * they click a button:
 *
 *   "This model models/gemini-3-pro-preview is no longer available."
 *
 * Retrying that is pointless — it will never succeed — and rotating keys does not
 * help either, because the model is gone for every key.
 */
export const isModelUnavailable = (error: unknown): boolean => {
  // `unknown`, not `any`: the body already treats the input as untrusted, and
  // the tests deliberately pass undefined, null and a bare string.
  const msg = String((error as { message?: unknown })?.message ?? error ?? '').toLowerCase();
  return msg.includes('no longer available')
      || msg.includes('not_found')
      || msg.includes('is not found')
      || (msg.includes('404') && msg.includes('model'));
};

/**
 * Why a model call failed, as far as FALLBACK is concerned.
 *
 * - `retired`    — the model id is gone (NOT_FOUND). Permanent.
 * - `no-quota`   — a 429 whose own message says `limit: 0` for this model: the
 *                  key's plan has no quota for it at all. Measured 2026-09-29 on
 *                  a free-tier key, which gets `limit: 0` for gemini-3.1-pro.
 *                  Waiting never helps, so retrying it only burns the budget.
 * - `overloaded` — 503 UNAVAILABLE / "high demand". Temporary, but it affects
 *                  everyone on that model, so another model is the best bet NOW.
 * - `transient`  — everything else, including a genuine rate limit (a 429 with a
 *                  non-zero limit) and an invalid key. Keeps the existing
 *                  retry / backoff / key-rotation behaviour; switching models
 *                  would not help with either.
 */
export type ModelFailure = 'retired' | 'no-quota' | 'overloaded' | 'transient';

export const classifyModelFailure = (error: unknown): ModelFailure => {
  if (isModelUnavailable(error)) return 'retired';
  const msg = String((error as { message?: unknown })?.message ?? error ?? '').toLowerCase();
  const isQuota = msg.includes('429') || msg.includes('resource_exhausted') || msg.includes('quota');
  // `limit: 0` and nothing numeric after it — so `limit: 0.5` or `limit: 05`
  // are not mistaken for "no quota at all".
  if (isQuota && /limit:\s*0(?![\d.])/.test(msg)) return 'no-quota';
  if (msg.includes('503') || msg.includes('high demand') || msg.includes('overloaded')
      || /"status":\s*"unavailable"/.test(msg) || msg.includes('\\"unavailable\\"')) return 'overloaded';
  return 'transient';
};

/** An Error carrying a machine-readable kind, for the UI to turn into a readable message. */
export type AiErrorKind = 'no-model' | 'all-models-busy';
const aiError = (kind: AiErrorKind, message: string): Error & { aiKind: AiErrorKind } =>
  Object.assign(new Error(message), { aiKind: kind });

/**
 * A readable error for when a tier has no working model left, replacing the raw
 * JSON the SDK throws. Names what was tried and the command that finds the truth.
 */
export const modelUnavailableError = (tier: AiTier): Error =>
  new Error(
    `No usable Gemini model for the "${tier}" tier — every candidate was rejected ` +
    `as unavailable (${MODEL_CANDIDATES[tier].join(', ')}). ` +
    // The env-var form, not the argv form. The script itself warns that a key
    // passed as an argument is recorded in shell history and visible in `ps`, so
    // recommending it here would have the app teach the habit its own tooling
    // tells you to avoid.
    `Set GEMINI_API_KEY and run "node scripts/list-gemini-models.mjs" from the ` +
    `excel-helper folder to see which models your key can use, then update ` +
    `MODEL_CANDIDATES in services/geminiService.ts.`,
  );

/**
 * The model to try next after `model` failed with `kind`, for THIS call.
 *
 * `retired` and `no-quota` are facts about the current key, so they go in the
 * per-key registry and later calls skip them too. `overloaded` is a fact about
 * this moment, not the key, so it is only added to `skipped` — this call's own
 * list — and the next call tries the model again.
 *
 * Only ids already in MODEL_CANDIDATES are ever returned; nothing is guessed.
 * Throws a readable `aiError` once the list is exhausted.
 */
const advanceModel = (
  tier: AiTier,
  model: string,
  kind: Exclude<ModelFailure, 'transient'>,
  skipped: Set<string>,
  onNotice?: ModelNotice,
): string => {
  if (kind === 'overloaded') skipped.add(model);
  else retiredFor(keyBucket()).add(model);

  // No quota is a fact about THIS key, not the model. With several keys, try
  // the same model on each other key before settling for a worse model —
  // otherwise one free-tier key drags every run down to Flash while the next
  // key could serve Pro. Keys already known to lack quota for it are skipped,
  // so each (key, model) pair costs at most one request. After a full cycle
  // with no taker the order is back where it started, and the list walk below
  // proceeds as with a single key. (Overload is the model's, for every key:
  // rotating would not help, so it never gets here.)
  if (kind === 'no-quota') {
    const keyCount = storedKeyCount();
    for (let i = 1; i < keyCount; i++) {
      rotateKey();
      if (!retiredFor(keyBucket()).has(model)) {
        // No key text in the notice, ever — only that a different one is used.
        const notice = `Model "${model}" has no quota on this API key; trying the next API key.`;
        console.warn(notice);
        onNotice?.(notice);
        return model;
      }
    }
    if (keyCount > 1) rotateKey(); // full cycle: back to the key we started on
  }

  const retired = retiredFor(keyBucket());
  const next = MODEL_CANDIDATES[tier].find((m) => !retired.has(m) && !skipped.has(m));
  if (!next) {
    throw skipped.size > 0
      ? aiError('all-models-busy', `Every "${tier}" model is unavailable for this key or overloaded right now (tried ${MODEL_CANDIDATES[tier].join(', ')}).`)
      : aiError('no-model', modelUnavailableError(tier).message);
  }
  const why = kind === 'no-quota' ? 'has no quota on this API key'
    : kind === 'overloaded' ? 'is overloaded right now'
    : 'is unavailable';
  const notice = `Model "${model}" ${why}; continuing on "${next}". Output quality may differ.`;
  console.warn(notice);
  onNotice?.(notice);
  return next;
};

/** First candidate not retired for this key and not skipped in this call. */
const firstUsable = (tier: AiTier, skipped: ReadonlySet<string>): string => {
  const retired = retiredFor(keyBucket());
  return MODEL_CANDIDATES[tier].find((m) => !retired.has(m) && !skipped.has(m)) ?? resolveModel(tier);
};

// Error handling helpers
export const isKeyIssue = (error: any) => {
    const msg = error.message?.toLowerCase() || '';
    return msg.includes('429') || 
           msg.includes('quota') || 
           msg.includes('rate limit') ||
           msg.includes('401') || 
           msg.includes('403') || 
           msg.includes('invalid') || 
           msg.includes('api key');
};

export const rotateKey = () => {
    // Rotation logic to cycle through multiple API keys to avoid limits
    const allKeys = (localStorage.getItem(GEMINI_KEY_STORAGE) || '').split('\n').filter(k => k.trim());
    if (allKeys.length <= 1) return false;
    
    // Move first to last
    const [first, ...rest] = allKeys;
    const newOrder = [...rest, first];
    localStorage.setItem(GEMINI_KEY_STORAGE, newOrder.join('\n'));
    return true;
};

/** How many API keys are configured (one per line). */
const storedKeyCount = (): number =>
    (localStorage.getItem(GEMINI_KEY_STORAGE) || '').split(/\r?\n/).filter(k => k.trim()).length;

export const getMaxRetries = () => {
    const allKeys = (localStorage.getItem(GEMINI_KEY_STORAGE) || '').split('\n').filter(k => k.trim());
    return Math.max(4, allKeys.length + 1); // Ensure we can loop through at least all keys once
};

export const parseWaitTime = (error: any) => {
    const msg = error.message?.toLowerCase() || '';
    if (msg.includes('429') || msg.includes('quota') || msg.includes('rate limit')) {
        return 60;
    }
    return 2;
};

/**
 * Translator only: how long `translateBatch` waits, round by round, once EVERY
 * usable candidate of its tier has answered 503 overloaded / high demand.
 *
 * Overload is temporary and hits everyone on a model, so skipping to the next
 * model (`advanceModel`) is still the first move. But a key with no Pro quota
 * has only the Flash ids left, and during a capacity spike all of them can be
 * overloaded at once (seen 2026-10-06 in production: every Flash id answered
 * 503 within seconds and the run ended as a PARTIAL_ file). Waiting is what
 * helps then, so the whole list is tried again after each delay. Bounded: after
 * the last round the "all models busy" error reaches TranslateTab as before,
 * and it exports the usual PARTIAL_ workbook.
 *
 * Retired and no-quota models are untouched by this: they are facts about the
 * model or the key, still skipped at once and remembered per key, and never
 * wait. Overload never rotates keys either — it is the model, not the key.
 */
export const OVERLOAD_RETRY_DELAYS_S: readonly number[] = [15, 30, 60];

/**
 * The most a whole translation RUN may spend waiting on overload, across all of
 * its batches. The rounds above restart for each batch; this budget does not.
 * Without it a large workbook could wait 15 + 30 + 60 s for every batch. A wait
 * never exceeds what is left, and once nothing is left the run stops retrying
 * and ends as the usual PARTIAL_ file.
 */
export const OVERLOAD_RUN_BUDGET_S = 120;

/**
 * Seconds of overload waiting left for one run. Mutable on purpose: the caller
 * (TranslateTab) creates ONE per run and hands the same object to every batch.
 */
export interface OverloadBudget { remainingSeconds?: number }

/** The notice for one overload wait. No key text, ever. */
export const overloadRetryNotice = (seconds: number, round: number, rounds: number): string =>
  `All models are busy (temporary Gemini service overload) — retrying in ${seconds}s (${round}/${rounds}).`;

/** Logged once when the run's overload budget is spent and the run stops retrying. */
export const overloadBudgetSpentNotice = (): string =>
  `All models are still busy and this run's ${OVERLOAD_RUN_BUDGET_S}s wait budget for temporary Gemini service overload is used up — stopping.`;

// Function implementations requested by errors

export const translateBatch = async (
    items: {text: string, context?: string}[],
    options: {
        sourceLang: string,
        targetLang: string,
        domain: string,
        glossary: string[],
        /**
         * Called when the run moves to a different model. A fallback to a Flash
         * id changes the quality of every translation after it, and a
         * `console.warn` is not something a user reads — the caller needs to be
         * able to put this in the log and in the exported report.
         */
        onNotice?: (message: string) => void,
        /**
         * Called before each overload wait (see OVERLOAD_RETRY_DELAYS_S). Kept
         * apart from `onNotice`: a wait is not a model change, and TranslateTab
         * de-duplicates `onNotice` into the workbook's model report. Falls back
         * to `onNotice` when not given.
         */
        onRetryWait?: (message: string) => void,
        /**
         * The run's overload wait budget (see OVERLOAD_RUN_BUDGET_S), shared by
         * every batch of the run. Omitted: this call gets a budget of its own.
         */
        overloadBudget?: OverloadBudget,
    }
): Promise<string[]> => {
    let attempts = 0;
    let overloadRound = 0; // overload waits used so far, this call
    // The run's budget, filled in on first use so the number lives only here;
    // a call without one gets its own.
    const overloadBudget: OverloadBudget = options.overloadBudget ?? {};
    overloadBudget.remainingSeconds ??= OVERLOAD_RUN_BUDGET_S;
    const maxRetries = getMaxRetries();
    // Named so the shared retire-and-advance logic in the catch reads the same
    // here as in extractStructuredData, which takes its tier as a parameter.
    const tier: AiTier = 'quality';
    // Resolved from the candidate list, and re-resolved if one is retired mid-run.
    let model = resolveModel(tier);
    const skipped = new Set<string>(); // overloaded models, this call only
    while (attempts < maxRetries) {
        try {
            const client = getAiClient();
            // The 'quality' tier, by request: translation looks mechanical but
            // is not — idiom, domain terms and the glossary carve-out are
            // judgement calls. It LEADS with Pro rather than guaranteeing it; the
            // list ends in Flash ids so a retirement degrades the run instead of
            // ending it, and `onNotice` above exists so that is not silent.
            //
            // The cost, stated honestly: Pro has tighter free-tier limits than
            // Flash and this runs in batches, so 429s are likelier than on the
            // fast tier. With SEVERAL keys the handler below rotates and carries
            // on. With ONE key — the default — `rotateKey()` returns false, so
            // each 429 costs a 60s sleep and `getMaxRetries()` allows 4 attempts:
            // roughly three minutes before the error reaches TranslateTab. It
            // does NOT stop there — TranslateTab breaks out of its batch loop,
            // keeps everything already translated, and exports a `PARTIAL_`
            // workbook. Slow to fail, but it fails loudly and with the work
            // already done in hand.

            let translationInstruction = `Translate the following items from ${options.sourceLang} to ${options.targetLang}.`;
            if (options.sourceLang === 'auto' && options.targetLang === 'auto') {
                translationInstruction = `For each item, detect the primary language. If the text is primarily English, translate it entirely to Arabic. If the text is primarily Arabic, translate it entirely to English. Provide ONLY the translated text in the target language. CRITICAL: Do NOT echo or return the original language text. Output ONLY the final translated text.`;
            }

            const prompt = `
              ${translationInstruction}
              Domain: ${options.domain}.
              Glossary (Keep untranslated): ${options.glossary.join(', ')}.
              
              Items:
              ${JSON.stringify(items)}
              
              Return ONLY a JSON array of strings matching the input order.
            `;

            const response = await client.models.generateContent({
                model,
                contents: { parts: [{ text: prompt }] },
                config: { responseMimeType: 'application/json' }
            });
            
            try {
                return JSON.parse(response.text || "[]");
            } catch {
                return items.map(() => "");
            }
        } catch (error: any) {
            // Retired, no quota on this key, or overloaded: next candidate now,
            // without spending the retry budget (TD-051 — same rule as OCR).
            const failure = classifyModelFailure(error);
            if (failure !== 'transient') {
                try {
                    model = advanceModel(tier, model, failure, skipped, options.onNotice);
                } catch (exhausted) {
                    // Every usable candidate is overloaded right now: wait, then
                    // walk the whole list again (OVERLOAD_RETRY_DELAYS_S). Any other
                    // end of the list, the last round spent, or the RUN's budget
                    // spent (OVERLOAD_RUN_BUDGET_S), propagates as before.
                    if ((exhausted as { aiKind?: AiErrorKind })?.aiKind !== 'all-models-busy'
                        || overloadRound >= OVERLOAD_RETRY_DELAYS_S.length) throw exhausted;
                    const left: number = overloadBudget.remainingSeconds ?? 0;
                    if (left <= 0) {
                        const spent = overloadBudgetSpentNotice();
                        console.warn(spent);
                        (options.onRetryWait ?? options.onNotice)?.(spent);
                        throw exhausted;
                    }
                    const seconds = Math.min(OVERLOAD_RETRY_DELAYS_S[overloadRound++], left);
                    overloadBudget.remainingSeconds = left - seconds;
                    const notice = overloadRetryNotice(seconds, overloadRound, OVERLOAD_RETRY_DELAYS_S.length);
                    console.warn(notice);
                    (options.onRetryWait ?? options.onNotice)?.(notice);
                    await new Promise(r => setTimeout(r, seconds * 1000));
                    // Same key, same per-key retirements; only this call's
                    // overload skips are forgotten.
                    skipped.clear();
                    model = firstUsable(tier, skipped);
                }
                continue;
            }

            const isKeyProblem = isKeyIssue(error);
            attempts++;

            if (attempts >= maxRetries) throw error;

            if (isKeyProblem) {
                const rotated = rotateKey();
                if (rotated) {
                    // Re-resolve: `keyBucket()` now answers for a DIFFERENT key, and
                    // retirements are per key. Carrying the old key's choice over
                    // would keep the run on a Flash id that only the previous key
                    // needed — the exact downgrade the per-key registry exists to
                    // prevent. Re-resolving costs at most one request if the new key
                    // cannot use the preferred id either, and that gets recorded in
                    // the new key's own bucket.
                    model = firstUsable(tier, skipped);
                    await new Promise(r => setTimeout(r, 1000));
                    continue; 
                }
                const waitSeconds = parseWaitTime(error);
                console.warn(`API limit/error reached in translateBatch. Waiting ${waitSeconds} seconds...`);
                await new Promise(r => setTimeout(r, waitSeconds * 1000));
                continue;
            }
            await new Promise(r => setTimeout(r, 1000));
        }
    }
    return items.map(() => "");
};

/**
 * @param tier Defaults to 'fast'. Web Scraper asks for 'quality'; OCR's text path
 *   deliberately does not, so switching one does not silently switch the other.
 *   Both share this function, and a hardcoded model here would tie them together.
 *   A tier rather than a model id keeps the caller free of Gemini specifics — see
 *   `AiTier`.
 */
/**
 * The most input text a single structured extraction sends to the model; the
 * rest is cut. Exported so callers that CONVERT files to text (OCR's
 * spreadsheet and Word input) can warn against this same number instead of a
 * copy that could drift from it.
 */
export const MAX_EXTRACTION_TEXT = 500_000;

export const extractStructuredData = async (
    text: string,
    prompt: string,
    tier: AiTier = 'fast',
    onNotice?: ModelNotice,
): Promise<any[]> => {
    // Resolved from the candidate list, and re-resolved if one is retired mid-run.
    let model = resolveModel(tier);
    let attempts = 0;
    const maxRetries = getMaxRetries();
    const skipped = new Set<string>(); // overloaded models, this call only
    while (attempts < maxRetries) {
        try {
            const client = getAiClient();

            const fullPrompt = `
              ${prompt}
              
              Input Text:
              ${text.substring(0, MAX_EXTRACTION_TEXT)}
              
              Return a valid JSON array.
            `;

            const response = await client.models.generateContent({
                model,
                contents: { parts: [{ text: fullPrompt }] },
                config: { responseMimeType: 'application/json' }
            });

            try {
                return JSON.parse(response.text || "[]");
            } catch {
                return [];
            }
        } catch (error: any) {
            // Retired, no quota on this key, or overloaded: next candidate now.
            // Same rule as extractFromMedia — none of these is helped by waiting.
            const failure = classifyModelFailure(error);
            if (failure !== 'transient') {
                model = advanceModel(tier, model, failure, skipped, onNotice);
                continue;
            }

            const isKeyProblem = isKeyIssue(error);
            attempts++;

            if (attempts >= maxRetries) throw error;

            if (isKeyProblem) {
                const rotated = rotateKey();
                if (rotated) {
                    // Re-resolve: `keyBucket()` now answers for a DIFFERENT key, and
                    // retirements are per key. Carrying the old key's choice over
                    // would keep the run on a Flash id that only the previous key
                    // needed — the exact downgrade the per-key registry exists to
                    // prevent. Re-resolving costs at most one request if the new key
                    // cannot use the preferred id either, and that gets recorded in
                    // the new key's own bucket.
                    model = firstUsable(tier, skipped);
                    await new Promise(r => setTimeout(r, 1000));
                    continue; 
                }
                const waitSeconds = parseWaitTime(error);
                console.warn(`API limit/error reached in extractStructuredData. Waiting ${waitSeconds} seconds...`);
                await new Promise(r => setTimeout(r, waitSeconds * 1000));
                continue;
            }
            await new Promise(r => setTimeout(r, 1000));
        }
    }
    return [];
};

// --- GENERAL FILE PROCESSING (NEW) ---
export const processGeneralFile = async (
  input: { data?: string, mimeType?: string, text?: string },
  instruction: string,
  onNotice?: ModelNotice,
): Promise<string> => {
  const parts: any[] = [];

  if (input.text) {
      parts.push({ text: input.text });
  } else if (input.data && input.mimeType) {
      parts.push({ inlineData: { data: input.data, mimeType: input.mimeType } });
  }

  parts.push({ text: instruction });

  // No attempt/quota retry loop here — this is a single call. The loop below
  // only walks past retired, no-quota and overloaded ids, so it is bounded by
  // the candidate list rather than by a retry count, and any other error
  // propagates immediately.
  const tier: AiTier = 'quality';
  let model = resolveModel(tier);
  const skipped = new Set<string>(); // overloaded models, this call only

  for (;;) {
    try {
      // Per attempt, not once: a no-quota fallback may have rotated the key.
      const client = getAiClient();
      const response = await client.models.generateContent({
          model,
          contents: { parts },
      });
      return response.text || "";
    } catch (error: any) {
      // Retired, no quota on this key, or overloaded: next candidate (TD-051).
      // Anything else propagates immediately, as before.
      const failure = classifyModelFailure(error);
      if (failure === 'transient') throw error;
      model = advanceModel(tier, model, failure, skipped, onNotice);
    }
  }
};

/**
 * One prompt in, text out, walking the candidate list on a retired id.
 *
 * Support Chat used to call `new GoogleGenAI(...).models.generateContent(...)`
 * directly with a hardcoded model. That made it the only feature with no
 * fallback: when `gemini-3-pro-preview` was retired it broke while everything
 * else degraded. Same shape as `processGeneralFile`'s loop — bounded by the
 * candidate list (a retired, no-quota or overloaded model moves to the next
 * one), and any other error propagates immediately.
 */
export const generateText = async (
  prompt: string,
  tier: AiTier = 'fast',
  onNotice?: ModelNotice,
): Promise<string> => {
  let model = resolveModel(tier);
  const skipped = new Set<string>(); // overloaded models, this call only

  for (;;) {
    try {
      // Per attempt, not once: a no-quota fallback may have rotated the key.
      const client = getAiClient();
      const response = await client.models.generateContent({
        model,
        contents: prompt,
      });
      return response.text || "";
    } catch (error: any) {
      // Retired, no quota on this key, or overloaded: next candidate (TD-051).
      const failure = classifyModelFailure(error);
      if (failure === 'transient') throw error;
      model = advanceModel(tier, model, failure, skipped, onNotice);
    }
  }
};

// --- OCR / MULTIMODAL EXTRACTION ---

export const extractFromMedia = async (
  mediaData: { data: string, mimeType: string },
  instruction: string,
  onProgress?: (msg: string) => void,
  onNotice?: ModelNotice,
): Promise<any[]> => {
  // Pro for high-quality OCR reasoning. `let`, because a retired id falls back
  // to the other model once rather than taking OCR down — see the catch below.
  const tier: AiTier = 'quality';
  let model = resolveModel(tier);

  const prompt = `
    You are an expert AI specialized in Optical Character Recognition (OCR) and Document Understanding.
    Your task is to extract structured data from the provided image or PDF.
    
    User Instruction: "${instruction}"

    CRITICAL RULES FOR EXTRACTION:
    1. **Visual Layout Analysis & Categorization**: 
       - Analyze the document layout (columns, headers, sections).
       - **ALWAYS** identify section headers (e.g., "Appetizers", "Shawarma", "Brost", "Date").
       - **MANDATORY**: Include a field named "Category" (or "Section") in every extracted object.
    
    2. **Multilingual Translation & Concatenation (ALL FIELDS)**: 
       - Apply this rule to: 'Product Name', 'Description', 'Category', 'Option 1', 'Option 1 Value', 'Option 2', 'Option 2 Value', 'Option 3', 'Option 3 Value'.
       - **Detect Language**:
         - If text is **Arabic only**: Translate to English and format as "Arabic | English".
         - If text is **English only**: Translate to Arabic and format as "English | Arabic".
         - If text is **Mixed** (contains BOTH Arabic and English script): **KEEP AS IS**. Do NOT translate. Do NOT duplicate.
         - Example (Mixed): "Chicken Burger برجر دجاج" -> Output: "Chicken Burger برجر دجاج".
         - Example (Arabic): "بطاطس" -> Output: "بطاطس | Fries".
    
    3. **Variable Product Detection (Aggressive Splitting)**:
       - **CRITICAL**: If an item line contains multiple choices/sizes (e.g. "Spicy / Regular", "Small / Large", "Sandwich / Meal"), you must **SPLIT** this into separate JSON objects.
       - **CRITICAL (PRICE RANGES)**: A price written as a range (e.g. "20 - 30", "600–900") is NOT a set of variants. Keep it as ONE object and copy the range text exactly as written into 'Retail Price' (e.g. "Retail Price": "20 - 30"). Never split a range into one object per price, and never invent size names such as "Small" / "Large" for it. The app turns the range into Price 0 with the range in the Description.
       - **Do NOT** put all options in one cell. Create a new row for each option combination.
       - **Fields**:
         - 'Product Name': The main item name (Apply Rule 2).
         - 'Description': Any details below the name (Apply Rule 2).
         - 'Option 1': The category of the option (e.g. "Flavor", "Size", "Type").
         - 'Option 1 Value': The specific choice (e.g. "Spicy", "Regular"). (Apply Rule 2).
         - If there are multiple variant dimensions (e.g. Size AND Color), use 'Option 2', 'Option 2 Value', 'Option 3', 'Option 3 Value' for the additional variants.
         - 'Retail Price': The price corresponding to that choice.
         - 'Type': Set to "Variable".
       
       - **Example 1 (Single Variant Dimension)**: 
         Image text: "Brost .... 18 .... (Spicy / Regular)"
         Output JSON:
         [
           {"Product Name": "Brost | بروست", "Option 1": "Flavor", "Option 1 Value": "Spicy | حراق", "Retail Price": 18, "Type": "Variable"},
           {"Product Name": "Brost | بروست", "Option 1": "Flavor", "Option 1 Value": "Regular | عادي", "Retail Price": 18, "Type": "Variable"}
         ]

       - **Example 1.5 (Price Range — ONE row)**: 
         Image text: "Chicken Burger .... 20 - 30"
         Output JSON:
         [
           {"Product Name": "Chicken Burger | برجر دجاج", "Retail Price": "20 - 30", "Type": "Simple"}
         ]
         Image text: "Hair Dye: Short 400 / Medium 500 / Long 600–900"
         Output JSON (the range stays on the ONE "Long" row):
         [
           {"Product Name": "Hair Dye | صبغة شعر", "Option 1": "Length", "Option 1 Value": "Short | قصير", "Retail Price": 400, "Type": "Variable"},
           {"Product Name": "Hair Dye | صبغة شعر", "Option 1": "Length", "Option 1 Value": "Medium | وسط", "Retail Price": 500, "Type": "Variable"},
           {"Product Name": "Hair Dye | صبغة شعر", "Option 1": "Length", "Option 1 Value": "Long | طويل", "Retail Price": "600–900", "Type": "Variable"}
         ]
         
       - **Example 2 (Multiple Variant Dimensions)**:
         Image text: "T-Shirt .... 50 .... (Small / Large) (Red / Blue)"
         Output JSON:
         [
           {"Product Name": "T-Shirt | تي شيرت", "Option 1": "Size", "Option 1 Value": "Small | صغير", "Option 2": "Color", "Option 2 Value": "Red | أحمر", "Retail Price": 50, "Type": "Variable"},
           {"Product Name": "T-Shirt | تي شيرت", "Option 1": "Size", "Option 1 Value": "Small | صغير", "Option 2": "Color", "Option 2 Value": "Blue | أزرق", "Retail Price": 50, "Type": "Variable"},
           {"Product Name": "T-Shirt | تي شيرت", "Option 1": "Size", "Option 1 Value": "Large | كبير", "Option 2": "Color", "Option 2 Value": "Red | أحمر", "Retail Price": 50, "Type": "Variable"},
           {"Product Name": "T-Shirt | تي شيرت", "Option 1": "Size", "Option 1 Value": "Large | كبير", "Option 2": "Color", "Option 2 Value": "Blue | أزرق", "Retail Price": 50, "Type": "Variable"}
         ]
         
    4. **Simple Products**:
       - If an item has NO options, set 'Type' to "Simple" and leave Variant fields empty.
    
    5. **Output Format**: 
       - RETURN ONLY A VALID JSON ARRAY of objects.
       - Do not wrap in markdown code blocks (\`\`\`json). Just the raw JSON string.
    
    Start extraction now.
  `;

  let attempts = 0;
  const maxRetries = getMaxRetries();
  // Models skipped in THIS call because they were overloaded (see advanceModel).
  const skipped = new Set<string>();
  while (true) {
    try {
      const client = getAiClient();
      
      const responseStream = await client.models.generateContentStream({
        model: model,
        contents: {
          parts: [
            { inlineData: mediaData },
            { text: prompt }
          ]
        },
        config: {
          responseMimeType: "application/json",
        }
      });

      let jsonText = "";
      let extractedCount = 0;

      for await (const chunk of responseStream) {
        if (chunk.text) {
          jsonText += chunk.text;
          
          // Try to extract "Product Name" or "Name" values from the partial JSON
          if (onProgress) {
              const matches = [...jsonText.matchAll(/"(?:Product Name|Name|Item)"\s*:\s*"([^"]+)"/g)];
              if (matches.length > extractedCount) {
                  for (let i = extractedCount; i < matches.length; i++) {
                      onProgress(`Found: ${matches[i][1]}`);
                  }
                  extractedCount = matches.length;
              }
          }
        }
      }

      const cleanJson = jsonText.trim().replace(/```json|```/g, '');
      let parsed;
      try {
        parsed = JSON.parse(cleanJson);
      } catch (e) {
        console.warn("JSON Parse Failed", e);
        throw new Error("AI returned invalid JSON.");
      }
      
      if (Array.isArray(parsed)) return parsed;
      // If mapped under a key
      if (typeof parsed === 'object') {
        const values = Object.values(parsed);
        if (values.length > 0 && Array.isArray(values[0])) return values[0] as any[];
        // Single object return? Wrap in array
        return [parsed];
      }
      
      throw new Error("AI output format unrecognized (not array or object).");

    } catch (error: any) {
      // A model problem — retired, no quota on this key, or overloaded — moves
      // to the next candidate at once. None of these is helped by waiting, so
      // none may consume the retry budget. (The live run of 2026-09-29 spent
      // four 429s and three minutes on a model its free key had NO quota for.)
      // Fallback notices go on `onNotice` only, never `onProgress`: OcrTab logs
      // progress as success, and a quality downgrade is not success.
      const failure = classifyModelFailure(error);
      if (failure !== 'transient') {
        model = advanceModel(tier, model, failure, skipped, onNotice);
        continue;
      }

      const isKeyProblem = isKeyIssue(error);
      attempts++;

      if (attempts >= maxRetries) throw error;

      if (isKeyProblem) {
        const rotated = rotateKey();
        if (rotated) {
          // Re-resolve for the same reason as the other rotate sites: retirements
          // are per key, and `keyBucket()` now answers for a different one.
          model = firstUsable(tier, skipped);
          await new Promise(r => setTimeout(r, 1000));
          continue;
        }
        const waitSeconds = parseWaitTime(error);
        console.warn(`API limit/error reached. Waiting ${waitSeconds} seconds...`);
        await new Promise(r => setTimeout(r, waitSeconds * 1000));
        continue;
      }
      await new Promise(r => setTimeout(r, 1000));
    }
  }
};

export class GeminiService implements IAiService {
  // `Parameters<>` rather than a third copy of the shape. This class, the module
  // function and `IAiService` all declared it, and the last change updated two of
  // the three: `onNotice` reached the module function at runtime only because
  // this method forwards `options` wholesale, and callers type-check against
  // `IAiService`, so nothing failed — the declaration was just quietly wrong.
  async translateBatch(
      items: { text: string; context?: string }[],
      options: Parameters<typeof translateBatch>[1]
  ): Promise<string[]> {
      return translateBatch(items, options);
  }

  // Every one of these forwards its trailing `onNotice` — the callback that tells
  // a caller its request moved to a weaker model. Forgetting it here would
  // compile and silently drop the notice, which is exactly how `translateBatch`
  // ended up the only feature that reported a fallback.
  async extractStructuredData(
      text: string,
      prompt: string,
      tier?: AiTier,
      onNotice?: ModelNotice,
  ): Promise<any[]> {
      return extractStructuredData(text, prompt, tier, onNotice);
  }

  async processGeneralFile(
      input: { data?: string; mimeType?: string; text?: string },
      instruction: string,
      onNotice?: ModelNotice,
  ): Promise<string> {
      return processGeneralFile(input, instruction, onNotice);
  }

  async extractFromMedia(
      mediaData: { data: string; mimeType: string },
      instruction: string,
      onProgress?: (msg: string) => void,
      onNotice?: ModelNotice,
  ): Promise<any[]> {
      return extractFromMedia(mediaData, instruction, onProgress, onNotice);
  }

  async generateText(prompt: string, tier?: AiTier, onNotice?: ModelNotice): Promise<string> {
      return generateText(prompt, tier, onNotice);
  }
}
