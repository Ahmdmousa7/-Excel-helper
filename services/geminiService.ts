
import { GoogleGenAI, Schema, Type } from "@google/genai";
import { AiTier, IAiService } from "../types/ai.types";

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
 * broken feature. `resolveModel()` and `retireModel()` below do the walking.
 *
 * Ordering is the only judgement here:
 *   quality — newest Pro first, older Pro ids behind it, Flash last so the tier
 *             degrades in quality rather than failing outright.
 *   fast    — Flash ids only until the end, where a Pro id is better than nothing.
 *
 * `gemini-3.1-pro` leads the quality list by request. If it is not a valid id on
 * your key it is skipped automatically — which is the entire point of a list.
 * `GEMINI_API_KEY=… node scripts/list-gemini-models.mjs` prints what your key can
 * actually use, and is the way to confirm rather than infer. Via the env var, not
 * as an argument — the script explains why.
 *
 * This is now the ONLY place model ids live. `components/SupportChat.tsx` used to
 * hold its own literal and call the SDK directly, which is why it was the single
 * feature with no fallback when an id was retired; it goes through
 * `generateText()` now. `grep -rn "gemini-" components/` should stay empty.
 */
export const MODEL_CANDIDATES: Record<AiTier, readonly string[]> = {
  quality: [
    'gemini-3.1-pro',
    'gemini-3-pro',
    'gemini-3-pro-preview',
    'gemini-3.1-flash',
    'gemini-3-flash',
    'gemini-3-flash-preview',
  ],
  fast: [
    'gemini-3.1-flash',
    'gemini-3-flash',
    'gemini-3-flash-preview',
    'gemini-3.1-pro',
    'gemini-3-pro',
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
const GROQ_KEY_STORAGE = 'groq_api_key';

export const getStoredApiKeys = () => {
  return {
    gemini: localStorage.getItem(GEMINI_KEY_STORAGE) || '',
    groq: localStorage.getItem(GROQ_KEY_STORAGE) || ''
  };
};

export const setStoredApiKeys = (gemini: string, groq: string) => {
  localStorage.setItem(GEMINI_KEY_STORAGE, gemini);
  localStorage.setItem(GROQ_KEY_STORAGE, groq);
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

export const verifyGeminiKey = async (keysString: string): Promise<'valid' | 'invalid' | 'quota'> => {
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

    // Every candidate rejected: a broken app, not a broken key. 'invalid' is all
    // this signature can express — the error thrown by the real calls carries the
    // full explanation and points at the model-listing script.
    return 'invalid';
};

export const verifyGroqKey = async (key: string): Promise<boolean> => {
    // Placeholder as Groq implementation details are not the focus, assuming simple check
    return key.length > 10;
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
    }
): Promise<string[]> => {
    let attempts = 0;
    const maxRetries = getMaxRetries();
    // Named so the shared retire-and-advance logic in the catch reads the same
    // here as in extractStructuredData, which takes its tier as a parameter.
    const tier: AiTier = 'quality';
    // Resolved from the candidate list, and re-resolved if one is retired mid-run.
    let model = resolveModel(tier);
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
            // A retired model id first: retrying is pointless and rotating keys
            // cannot help, since the model is gone for every key. Strike it off
            // and move to the next candidate. Does NOT count against `attempts`
            // — walking the list is not a retry of the same failing thing.
            if (isModelUnavailable(error)) {
                const next = retireModel(tier, model);
                if (next) {
                    const notice = `Model "${model}" is unavailable; continuing on "${next}". Translation quality may differ.`;
                    console.warn(notice);
                    options.onNotice?.(notice);
                    model = next;
                    continue;
                }
                throw modelUnavailableError(tier);
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
                    model = resolveModel(tier);
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
export const extractStructuredData = async (
    text: string,
    prompt: string,
    tier: AiTier = 'fast',
): Promise<any[]> => {
    // Resolved from the candidate list, and re-resolved if one is retired mid-run.
    let model = resolveModel(tier);
    let attempts = 0;
    const maxRetries = getMaxRetries();
    while (attempts < maxRetries) {
        try {
            const client = getAiClient();

            const fullPrompt = `
              ${prompt}
              
              Input Text:
              ${text.substring(0, 500000)}
              
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
            // A retired model id first: retrying is pointless and rotating keys
            // cannot help, since the model is gone for every key. Strike it off
            // and move to the next candidate. Does NOT count against `attempts`
            // — walking the list is not a retry of the same failing thing.
            if (isModelUnavailable(error)) {
                const next = retireModel(tier, model);
                if (next) {
                    console.warn(`Model "${model}" is retired; trying "${next}".`);
                    model = next;
                    continue;
                }
                throw modelUnavailableError(tier);
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
                    model = resolveModel(tier);
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
  instruction: string
): Promise<string> => {
  const client = getAiClient();

  const parts: any[] = [];

  if (input.text) {
      parts.push({ text: input.text });
  } else if (input.data && input.mimeType) {
      parts.push({ inlineData: { data: input.data, mimeType: input.mimeType } });
  }

  parts.push({ text: instruction });

  // No attempt/quota retry loop here — this is a single call. The loop below
  // exists only to walk past retired ids, so it is bounded by the candidate list
  // rather than by a retry count, and any other error propagates immediately.
  const tier: AiTier = 'quality';
  let model = resolveModel(tier);

  for (;;) {
    try {
      const response = await client.models.generateContent({
          model,
          contents: { parts },
      });
      return response.text || "";
    } catch (error: any) {
      if (!isModelUnavailable(error)) throw error;

      const next = retireModel(tier, model);
      if (!next) throw modelUnavailableError(tier);
      console.warn(`Model "${model}" is retired; trying "${next}".`);
      model = next;
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
 * candidate list, and any non-model error propagates immediately.
 */
export const generateText = async (
  prompt: string,
  tier: AiTier = 'fast',
): Promise<string> => {
  const client = getAiClient();
  let model = resolveModel(tier);

  for (;;) {
    try {
      const response = await client.models.generateContent({
        model,
        contents: prompt,
      });
      return response.text || "";
    } catch (error: any) {
      if (!isModelUnavailable(error)) throw error;

      const next = retireModel(tier, model);
      if (!next) throw modelUnavailableError(tier);
      console.warn(`Model "${model}" is retired; trying "${next}".`);
      model = next;
    }
  }
};

// --- OCR / MULTIMODAL EXTRACTION ---

export const extractFromMedia = async (
  mediaData: { data: string, mimeType: string },
  instruction: string,
  onProgress?: (msg: string) => void
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
       - **CRITICAL (PRICE RANGES)**: If a price is written as a range (e.g. "20 - 30", "20/30", "15-25"), it means it is a VARIABLE product with multiple prices. You MUST create two (or more) separate JSON objects entries. If no specific size name is provided in the text, use "Small | صغير" for the lower price and "Large | كبير" for the higher price, and put them under 'Option 1': "Size".
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

       - **Example 1.5 (Price Range Dimension)**: 
         Image text: "Chicken Burger .... 20 - 30"
         Output JSON:
         [
           {"Product Name": "Chicken Burger | برجر دجاج", "Option 1": "Size", "Option 1 Value": "Small | صغير", "Retail Price": 20, "Type": "Variable"},
           {"Product Name": "Chicken Burger | برجر دجاج", "Option 1": "Size", "Option 1 Value": "Large | كبير", "Retail Price": 30, "Type": "Variable"}
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
      // A retired model id, before anything else. Retrying it is pointless and
      // rotating keys cannot help — the model is gone for every key. Strike it
      // off and walk to the next candidate so OCR keeps working, degraded,
      // instead of failing outright. Does NOT count against `attempts`.
      if (isModelUnavailable(error)) {
        const next = retireModel(tier, model);
        if (!next) throw modelUnavailableError(tier);
        console.warn(`Model "${model}" is retired; trying OCR on "${next}".`);
        onProgress?.(`Model ${model} unavailable — trying ${next}`);
        model = next;
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
          model = resolveModel(tier);
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

  async extractStructuredData(text: string, prompt: string, tier?: AiTier): Promise<any[]> {
      return extractStructuredData(text, prompt, tier);
  }

  async processGeneralFile(
      input: { data?: string; mimeType?: string; text?: string },
      instruction: string
  ): Promise<string> {
      return processGeneralFile(input, instruction);
  }

  async extractFromMedia(
      mediaData: { data: string; mimeType: string },
      instruction: string,
      onProgress?: (msg: string) => void
  ): Promise<any[]> {
      return extractFromMedia(mediaData, instruction, onProgress);
  }

  async generateText(prompt: string, tier?: AiTier): Promise<string> {
      return generateText(prompt, tier);
  }
}
