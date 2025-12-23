
import { GoogleGenAI, Type } from "@google/genai";
import { BranchingResponse, GroundingSource } from "../types";

export const getTopicInfo = async (
  concept: string
): Promise<{ description: string, sources: GroundingSource[] }> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
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
  } catch (error) {
    console.error("Gemini Topic Info Error:", error);
    return { description: "Explore the connections and history of this concept.", sources: [] };
  }
};

export const getRelatedTopics = async (
  concept: string, 
  count: number = 3,
  contextPath: string[] = [],
  excludeTopics: string[] = []
): Promise<{ topics: BranchingResponse[], sources: GroundingSource[] }> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const contextDescription = contextPath.length > 0 
    ? `The user's current exploration path is: ${contextPath.join(' -> ')} -> ${concept}.` 
    : `The user is starting an exploration on: ${concept}.`;

  const exclusionPrompt = excludeTopics.length > 0
    ? `Do not suggest any of the following topics: ${excludeTopics.join(', ')}.`
    : "";

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `${contextDescription} 
                ${exclusionPrompt}
                Suggest exactly ${count} NEW distinct and high-level topics branching specifically from "${concept}". 
                Each suggestion must be unique and not repeat the parent topic.
                Provide a one-sentence factual insight for each.`,
      config: {
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

    const text = response.text || "";
    let jsonStr = text.trim();
    
    // Fallback: If the model wraps it in markdown blocks despite the MIME type
    if (jsonStr.includes("```json")) {
      jsonStr = jsonStr.split("```json")[1].split("```")[0].trim();
    } else if (jsonStr.includes("```")) {
      jsonStr = jsonStr.split("```")[1].split("```")[0].trim();
    }
    
    const data = JSON.parse(jsonStr);
    if (!data.topics || !Array.isArray(data.topics)) {
      throw new Error("Invalid response format");
    }
    
    return { 
      topics: data.topics.slice(0, count), 
      sources: [] 
    };
  } catch (error) {
    console.error("Gemini Branching Error:", error);
    // Provide an immediate fallback instead of hanging
    return {
      topics: [
        { topic: `${concept} Dynamics`, description: "Exploring the fundamental forces and shifts within this field." },
        { topic: `${concept} Evolution`, description: "Tracing the historical development and future trajectory." },
        { topic: `${concept} Impact`, description: "Analyzing the broader social and technical consequences." }
      ].slice(0, count),
      sources: []
    };
  }
};
