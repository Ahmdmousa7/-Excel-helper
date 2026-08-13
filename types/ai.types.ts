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

export interface IAiService {
    translateBatch(
        items: { text: string; context?: string }[],
        options: {
            sourceLang: string;
            targetLang: string;
            domain: string;
            glossary: string[];
            /**
             * Called when the run moves to a different model mid-flight.
             *
             * The quality tier ends in Flash ids so a retirement degrades the
             * translation rather than failing the run — but that changes the
             * quality of every item after it, and a `console.warn` is not
             * something a user reads. The caller needs it to be able to put the
             * fallback in the log and in the exported file.
             */
            onNotice?: (message: string) => void;
        }
    ): Promise<string[]>;

    /**
     * @param tier Shared by Web Scraper ('quality') and OCR's text path
     *   (default, 'fast'), which deliberately run on different models. Omit for
     *   'fast'.
     */
    extractStructuredData(text: string, prompt: string, tier?: AiTier): Promise<any[]>;

    processGeneralFile(
        input: { data?: string; mimeType?: string; text?: string },
        instruction: string
    ): Promise<string>;

    /**
     * One prompt in, text out. The plainest possible call.
     *
     * Exists so a caller that needs nothing more than that does not reach for the
     * provider SDK itself — which is what Support Chat used to do, and why it was
     * the one feature with no model fallback when an id was retired.
     *
     * @param tier Defaults to 'fast'.
     */
    generateText(prompt: string, tier?: AiTier): Promise<string>;

    extractFromMedia(
        mediaData: { data: string; mimeType: string },
        instruction: string,
        onProgress?: (msg: string) => void
    ): Promise<any[]>;
}
