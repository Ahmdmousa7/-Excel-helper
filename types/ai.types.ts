export interface IAiService {
    translateBatch(
        items: { text: string; context?: string }[],
        options: { sourceLang: string; targetLang: string; domain: string; glossary: string[] }
    ): Promise<string[]>;

    /**
     * @param model Optional provider model id. Shared by Web Scraper and OCR's
     *   text path, which deliberately run on different models — see the
     *   implementation. Omit it to take the provider's default.
     */
    extractStructuredData(text: string, prompt: string, model?: string): Promise<any[]>;

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
