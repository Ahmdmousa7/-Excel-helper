/**
 * Which class of model a call wants — NOT a model id.
 *
 * `aiServiceFactory` promises you can swap `GeminiService` for another provider
 * in one line. A raw `model: string` would quietly break that: the caller would
 * have to know Gemini's ids, and a Groq or OpenRouter implementation would
 * receive a string it cannot honour. A tier is something every provider can map
 * to something of its own.
 *
 *   'fast'    — cheap, high-volume, mechanical extraction
 *   'quality' — reasoning, messy input, anything multimodal
 */
export type AiTier = 'fast' | 'quality';

/**
 * Called when a request moves to a different model part-way through.
 *
 * Every tier is a LIST that ends in ids from the other family, so a retirement
 * degrades the request rather than failing it — the right trade, but it silently
 * changes the quality of everything after it. A `console.warn` is not something a
 * user reads, so each entry point takes this and the caller decides where it goes:
 * the log, the UI, or the exported file.
 *
 * Optional everywhere, and provider-agnostic — a provider with no fallback
 * concept simply never calls it.
 */
export type ModelNotice = (message: string) => void;

/**
 * What testing an API key can conclude.
 *
 * `'no-model'` is the reason this is a named type rather than an inline union.
 * It means the key answered but no id in the tier exists for it — the app's
 * model list is stale, and nothing is wrong with the key. That used to be
 * reported as `'invalid'`, which sent the user to rotate a credential that was
 * never the problem (TD-039), and the union was spelled out in four places, so
 * adding a state meant finding all four.
 *
 *   'idle'     — not tested yet
 *   'valid'    — a model answered
 *   'invalid'  — the key was rejected
 *   'quota'    — the key is fine and rate-limited
 *   'no-model' — the key is fine and the app's model list is not
 */
export type ApiKeyStatus = 'idle' | 'valid' | 'invalid' | 'quota' | 'no-model';

export interface IAiService {
    translateBatch(
        items: { text: string; context?: string }[],
        options: {
            sourceLang: string;
            targetLang: string;
            domain: string;
            glossary: string[];
            /** See {@link ModelNotice}. Translate puts it in the exported workbook. */
            onNotice?: ModelNotice;
        }
    ): Promise<string[]>;

    /**
     * @param tier Shared by Web Scraper ('quality') and OCR's text path
     *   (default, 'fast'), which deliberately run on different models. Omit for
     *   'fast'.
     * @param onNotice See {@link ModelNotice}.
     */
    extractStructuredData(
        text: string,
        prompt: string,
        tier?: AiTier,
        onNotice?: ModelNotice,
    ): Promise<any[]>;

    /** @param onNotice See {@link ModelNotice}. */
    processGeneralFile(
        input: { data?: string; mimeType?: string; text?: string },
        instruction: string,
        onNotice?: ModelNotice,
    ): Promise<string>;

    /**
     * One prompt in, text out. The plainest possible call.
     *
     * Exists so a caller that needs nothing more than that does not reach for the
     * provider SDK itself — which is what Support Chat used to do, and why it was
     * the one feature with no model fallback when an id was retired.
     *
     * @param tier Defaults to 'fast'.
     * @param onNotice See {@link ModelNotice}.
     */
    generateText(prompt: string, tier?: AiTier, onNotice?: ModelNotice): Promise<string>;

    /**
     * @param onProgress Per-file progress, shown inline during a batch.
     * @param onNotice See {@link ModelNotice}. Distinct from `onProgress`: this
     *   one is about output quality changing, not about how far along the run is,
     *   and a caller may well want to keep it after the progress text is gone.
     */
    extractFromMedia(
        mediaData: { data: string; mimeType: string },
        instruction: string,
        onProgress?: (msg: string) => void,
        onNotice?: ModelNotice,
    ): Promise<any[]>;
}
