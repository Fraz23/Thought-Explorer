
import { GoogleGenAI, Type } from "@google/genai";
import { BranchingResponse, GroundingSource } from "../types";

const aiInstance = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

export const getTopicInfo = async (
  concept: string
): Promise<{ description: string, sources: GroundingSource[] }> => {
  const ai = aiInstance();
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Provide a one-sentence factual insight for the concept: "${concept}". Return only the description text.`,
    config: {
      tools: [{ googleSearch: {} }],
    },
  });

  const sources: GroundingSource[] = [];
  const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
  if (chunks) {
    chunks.forEach((chunk: any) => {
      if (chunk.web) {
        sources.push({
          title: chunk.web.title || "Source",
          uri: chunk.web.uri
        });
      }
    });
  }

  return { 
    description: response.text?.trim() || "A fascinating area for exploration.", 
    sources 
  };
};

export const getRelatedTopics = async (
  concept: string, 
  count: number = 3,
  contextPath: string[] = [],
  excludeTopics: string[] = []
): Promise<{ topics: BranchingResponse[], sources: GroundingSource[] }> => {
  const ai = aiInstance();
  
  const contextDescription = contextPath.length > 0 
    ? `The user's current exploration path is: ${contextPath.join(' -> ')} -> ${concept}.` 
    : `The user is starting an exploration on: ${concept}.`;

  const exclusionPrompt = excludeTopics.length > 0
    ? `IMPORTANT: Do not suggest any of the following topics as they already exist in the current map: ${excludeTopics.join(', ')}.`
    : "";

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `${contextDescription} 
              ${exclusionPrompt}
              Suggest exactly ${count} NEW distinct and high-level topics branching specifically from "${concept}" that provide a logical progression of thought. 
              Each suggestion must be unique and not repeat the parent topic.
              Provide a one-sentence factual insight for each.`,
    config: {
      tools: [{ googleSearch: {} }],
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          topics: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                topic: { type: Type.STRING },
                description: { type: Type.STRING }
              },
              required: ["topic", "description"]
            }
          }
        },
        required: ["topics"]
      }
    },
  });

  const sources: GroundingSource[] = [];
  const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
  if (chunks) {
    chunks.forEach((chunk: any) => {
      if (chunk.web) {
        sources.push({
          title: chunk.web.title || "Source",
          uri: chunk.web.uri
        });
      }
    });
  }

  try {
    const data = JSON.parse(response.text || '{"topics": []}');
    // Enforce the count to prevent model hallucination of extra branches
    return { 
      topics: (data.topics || []).slice(0, count), 
      sources 
    };
  } catch (error) {
    console.error("Failed to parse Gemini JSON response:", error);
    return {
      topics: Array(count).fill(0).map((_, i) => ({
        topic: `${concept} Detail ${i + 1}`,
        description: "A related concept derived from the current thought path."
      })),
      sources: []
    };
  }
};
