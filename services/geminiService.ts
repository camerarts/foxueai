
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";

// Helper to get the client instance safely at runtime
// Priority: LocalStorage (User set) -> process.env (System set)
const getClient = () => {
  const customKey = typeof window !== 'undefined' ? localStorage.getItem('lva_custom_api_key') : null;
  const envKey = process.env.API_KEY;
  
  const apiKey = customKey || envKey;
  
  if (!apiKey || apiKey === 'undefined' || apiKey === '') {
    console.error("API Key check failed.");
    throw new Error("API Key is missing. Please configure it in the 'Key' settings or .env file.");
  }
  
  return new GoogleGenAI({ apiKey });
};

// Retry helper for 503 Overloaded errors with exponential backoff
const retryOperation = async <T>(operation: () => Promise<T>, retries = 3, delay = 2000): Promise<T> => {
  try {
    return await operation();
  } catch (error: any) {
    const msg = error.message || error.toString();
    if (retries > 0 && (msg.includes('503') || msg.includes('Overloaded') || msg.includes('overloaded'))) {
      console.warn(`Model overloaded, retrying... (${retries} left)`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return retryOperation(operation, retries - 1, delay * 2);
    }
    throw error;
  }
};

const handleApiError = (error: any, defaultMsg: string): never => {
  console.error(defaultMsg, error);
  const msg = error.message || error.toString();
  
  if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED')) {
      throw new Error("API 调用频率过高 (429)。请稍等 1 分钟后重试。");
  }
  if (msg.includes('400')) {
      throw new Error("请求参数无效 (400)。请检查提示词内容或 API Key 权限。");
  }
  if (msg.includes('503')) {
      throw new Error("模型服务当前繁忙 (503)。请稍后再试。");
  }
  throw new Error(msg || defaultMsg);
};

export const generateText = async (prompt: string, modelName: string = 'gemini-3-flash-preview'): Promise<string> => {
  try {
    if (!prompt || !prompt.trim()) throw new Error("Prompt is empty");
    const ai = getClient();
    const response: GenerateContentResponse = await retryOperation(() => ai.models.generateContent({
      model: modelName,
      contents: { parts: [{ text: prompt }] },
    }));
    return response.text || '';
  } catch (error: any) {
    handleApiError(error, "Failed to generate text");
  }
  return '';
};

/**
 * Enhanced JSON extraction that handles markdown blocks or leading/trailing text
 */
const extractJson = (text: string): string => {
    // 1. Try to find JSON block
    const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/```\s*([\s\S]*?)\s*```/);
    if (jsonMatch && jsonMatch[1]) {
        return jsonMatch[1].trim();
    }
    
    // 2. Look for the first '[' or '{' and the last ']' or '}'
    const startIdx = Math.min(
        text.indexOf('[') === -1 ? Infinity : text.indexOf('['),
        text.indexOf('{') === -1 ? Infinity : text.indexOf('{')
    );
    const endIdx = Math.max(
        text.lastIndexOf(']'),
        text.lastIndexOf('}')
    );

    if (startIdx !== Infinity && endIdx !== -1 && endIdx > startIdx) {
        return text.substring(startIdx, endIdx + 1).trim();
    }

    return text.trim();
};

export const generateJSON = async <T>(prompt: string, schema?: any): Promise<T> => {
  try {
    if (!prompt || !prompt.trim()) throw new Error("Prompt is empty");
    const ai = getClient();
    
    const response: GenerateContentResponse = await retryOperation(() => ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: { parts: [{ text: prompt }] },
      config: {
        responseMimeType: "application/json",
        responseSchema: schema
      }
    }));
    
    let text = response.text || '';
    
    // Check if the response looks like a Markdown table (starts with |)
    if (text.trim().startsWith('|')) {
        throw new Error("模型返回了 Markdown 表格而非 JSON 格式。正在尝试重新生成，请重试。");
    }

    const cleanedText = extractJson(text);
    
    try {
        return JSON.parse(cleanedText) as T;
    } catch (e) {
        console.error("JSON Parse Error. Raw Text:", text);
        throw new Error(`无法解析模型返回的 JSON 数据。原因: ${e instanceof Error ? e.message : '格式不正确'}`);
    }
  } catch (error: any) {
    handleApiError(error, "Failed to generate structured data");
  }
  return {} as T;
};

export const generateImage = async (prompt: string, modelName: string = 'gemini-2.5-flash-image'): Promise<string> => {
  try {
    const ai = getClient();
    const config: any = { imageConfig: { aspectRatio: "16:9" } };
    if (modelName === 'gemini-3-pro-image-preview') {
       config.imageConfig.imageSize = '1K';
    }

    const response: GenerateContentResponse = await retryOperation(() => ai.models.generateContent({
      model: modelName,
      contents: { parts: [{ text: prompt }] },
      config: config
    }));

    const candidate = response.candidates?.[0];
    if (candidate?.finishReason === 'SAFETY') throw new Error("图片生成被安全策略拦截。");

    for (const part of candidate?.content?.parts || []) {
      if (part.inlineData) {
        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      }
    }
    throw new Error("API 未返回图片数据");
  } catch (error: any) {
    handleApiError(error, "Failed to generate image");
  }
  return '';
};
