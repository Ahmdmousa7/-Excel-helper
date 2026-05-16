export interface IAiService {
    translateBatch(
        items: { text: string; context?: string }[],
        options: { sourceLang: string; targetLang: string; domain: string; glossary: string[] }
    ): Promise<string[]>;

    extractStructuredData(text: string, prompt: string): Promise<any[]>;

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
