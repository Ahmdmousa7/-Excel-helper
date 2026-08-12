
import { GoogleGenAI, Schema, Type } from "@google/genai";
import { IAiService } from "../types/ai.types";

/**
 * The two models this app uses, named once.
 *
 * They were repeated as string literals at five call sites, which is how a model
 * swap turns into a hunt. Flash is the cheap, fast one for high-volume mechanical
 * work; Pro is for reasoning and anything multimodal.
 *
 * Both are *preview* ids and Google retires those. If AI features start failing
 * with a model-not-found error, this is the first place to look — and note that
 * the key Test button only exercises FLASH, so a green "valid" badge says nothing
 * about whether PRO still resolves.
 */
export const GEMINI_FLASH = 'gemini-3-flash-preview';
export const GEMINI_PRO = 'gemini-3-pro-preview';

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

    try {
        const ai = new GoogleGenAI({ apiKey: keyToTest });
        const model = GEMINI_FLASH; // Lightweight model for check
        await ai.models.generateContent({
            model,
            contents: { parts: [{ text: "test" }] }
        });
        return 'valid';
    } catch (e: any) {
        if (e.message?.includes('429') || e.message?.includes('quota')) return 'quota';
        return 'invalid';
    }
};

export const verifyGroqKey = async (key: string): Promise<boolean> => {
    // Placeholder as Groq implementation details are not the focus, assuming simple check
    return key.length > 10;
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
    options: { sourceLang: string, targetLang: string, domain: string, glossary: string[] }
): Promise<string[]> => {
    let attempts = 0;
    const maxRetries = getMaxRetries();
    while (attempts < maxRetries) {
        try {
            const client = getAiClient();
            // Pro, by request. Translation is the one "mechanical" task where
            // reasoning still pays — idiom, domain terms and the glossary
            // carve-out are judgement calls. Costs more per batch and has tighter
            // free-tier limits than Flash, which is what the key rotation below
            // is for.
            const model = GEMINI_PRO;

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
            const isKeyProblem = isKeyIssue(error);
            attempts++;

            if (attempts >= maxRetries) throw error;

            if (isKeyProblem) {
                const rotated = rotateKey();
                if (rotated) {
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
 * @param model Defaults to Flash. Web Scraper passes Pro; OCR's text path
 *   deliberately does not, so switching one does not silently switch the other.
 *   Both share this function, and a hardcoded model here would tie them together.
 */
export const extractStructuredData = async (
    text: string,
    prompt: string,
    model: string = GEMINI_FLASH,
): Promise<any[]> => {
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
            const isKeyProblem = isKeyIssue(error);
            attempts++;

            if (attempts >= maxRetries) throw error;

            if (isKeyProblem) {
                const rotated = rotateKey();
                if (rotated) {
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
  const model = GEMINI_PRO; // Use Pro for general reasoning
  const client = getAiClient();

  const parts: any[] = [];
  
  if (input.text) {
      parts.push({ text: input.text });
  } else if (input.data && input.mimeType) {
      parts.push({ inlineData: { data: input.data, mimeType: input.mimeType } });
  }

  parts.push({ text: instruction });

  const response = await client.models.generateContent({
      model,
      contents: { parts }
  });

  return response.text || "";
};

// --- OCR / MULTIMODAL EXTRACTION ---

export const extractFromMedia = async (
  mediaData: { data: string, mimeType: string },
  instruction: string,
  onProgress?: (msg: string) => void
): Promise<any[]> => {
  // Using Pro for high quality OCR reasoning
  const model = GEMINI_PRO;
  
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
      const isKeyProblem = isKeyIssue(error);
      attempts++;

      if (attempts >= maxRetries) throw error;

      if (isKeyProblem) {
        const rotated = rotateKey();
        if (rotated) {
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
  async translateBatch(
      items: { text: string; context?: string }[],
      options: { sourceLang: string; targetLang: string; domain: string; glossary: string[] }
  ): Promise<string[]> {
      return translateBatch(items, options);
  }

  async extractStructuredData(text: string, prompt: string, model?: string): Promise<any[]> {
      return extractStructuredData(text, prompt, model);
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
}
