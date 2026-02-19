import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

const getKey = (provided?: string): string => provided || process.env.API_KEY || '';

export const generateAIResponse = async (
  prompt: string, 
  context?: string,
  apiKey?: string
): Promise<string> => {
  const key = getKey(apiKey);
  if (!key) {
    return "⚠️ API 키가 없습니다. Settings → Editor 에서 Gemini API 키를 입력해주세요.";
  }

  try {
    const ai = new GoogleGenAI({ apiKey: key });
    const modelId = 'gemini-3-flash-preview';
    
    let finalPrompt = prompt;
    if (context) {
      finalPrompt = `
Context (Current Note Content):
${context}

User Request:
${prompt}
      `;
    }

    const response: GenerateContentResponse = await ai.models.generateContent({
      model: modelId,
      contents: finalPrompt,
      config: {
        systemInstruction: "You are a helpful assistant embedded in a markdown note-taking app. Keep your answers concise, formatted in Markdown, and helpful for a writer or developer.",
      }
    });

    return response.text || "No response generated.";
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    if (error?.message?.includes('API_KEY') || error?.message?.includes('api key') || error?.status === 403) {
      return "⚠️ API 키가 유효하지 않습니다. Settings에서 올바른 키를 확인해주세요.";
    }
    return `오류가 발생했습니다: ${error?.message || 'Unknown error'}`;
  }
};

export const suggestTitle = async (content: string, apiKey?: string): Promise<string> => {
    const key = getKey(apiKey);
    if (!content || !key) return "Untitled Note";
    try {
        const ai = new GoogleGenAI({ apiKey: key });
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `Generate a short, concise file name (max 5 words) for the following content. Do not use special characters or extensions. Content: ${content.substring(0, 500)}`,
        });
        return response.text?.trim() || "Untitled Note";
    } catch (e) {
        return "Untitled Note";
    }
}