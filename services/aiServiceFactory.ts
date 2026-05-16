import { IAiService } from '../types/ai.types';
import { GeminiService } from './geminiService';

class AiServiceFactory {
    private static instance: IAiService;

    static getService(): IAiService {
        if (!this.instance) {
            // Here we instantiate the active AI provider.
            // To switch to a different provider (e.g., OpenRouter, Tesseract),
            // simply replace GeminiService with the new implementation.
            this.instance = new GeminiService();
        }
        return this.instance;
    }
}

export const aiService = AiServiceFactory.getService();
