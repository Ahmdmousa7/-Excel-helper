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
        options: { sourceLang: string; targetLang: string; domain: string; glossary: string[] }
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

    extractFromMedia(
        mediaData: { data: string; mimeType: string },
        instruction: string,
        onProgress?: (msg: string) => void
    ): Promise<any[]>;
}
